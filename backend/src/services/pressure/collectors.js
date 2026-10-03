// Collectors — fetch side of the Pressure Engine (spec §3 & §5).
//
// Calls the provider adapters, each returning the uniform envelope
// { ok, data, meta }. A failed call (ok:false / throw) means that component falls
// back to provider_climatology seeds before dropping.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  railDemand, roadFrequencyProxy, accessDemand,
  stayScarcity, weatherPull,
} from "./engine.js";
import { getBaselineVisitors, getClimatology } from "./seeds_v3.js";

const CONFIG_PATH = join(dirname(fileURLToPath(import.meta.url)), "../../config/runtime_config.json");
const runtimeConfig = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));

// Keeps meta.source alongside data so components can carry provenance.
const unwrap = async (p) => {
  try {
    const r = await p;
    return r && r.ok ? { data: r.data, source: r.meta?.source ?? null } : { data: null, source: null };
  } catch {
    return { data: null, source: null };
  }
};

/**
 * @returns { values, degradedRoad } ready for assembleRow().
 */
export async function collect(dest, date, { providers = {}, seed = {} } = {}) {
  const { baseline = {}, location = {} } = dest;
  const destId = dest._id || dest.id;
  const lat = dest.lat ?? location.lat;
  const lng = dest.lng ?? location.lng;

  const d = new Date(`${date}T00:00:00Z`);
  const month = d.getUTCMonth() + 1;
  const dow = d.getUTCDay();
  const isWeekend = dow === 0 || dow === 6;

  // Climatology fallback row for this destination/month/weekend
  const clim = getClimatology(destId, month, isWeekend);

  // calendar is a local lookup (seed.calendarRow returns finished { value, label })
  const cal = seed.calendarRow?.({ date, state: dest.state }) ?? { value: 0.1, label: "weekday" };

  const [railRes, roadRes, stayRes, wxRes] = await Promise.all([
    unwrap(providers.railradar?.arrivals?.({
      destId, railhead: dest.nearestRailhead, from: date, to: date,
    })),
    unwrap(providers.road?.services?.({
      destId, corridor: dest.roadAccess?.corridor, date,
    })),
    unwrap(providers.amadeus?.hotels?.({
      destId, date, calendarImpact: cal.value,
    })),
    unwrap(providers.openmeteo?.forecast?.({
      destId, lat, lng, date,
    })),
  ]);

  // Pass live weather if present, otherwise climatology weather to demandML
  const weatherDataForML = wxRes.data || (clim ? { maxTempC: clim.tempC, precipMm: clim.precipMm } : null);
  const demandRes = await unwrap(
    providers.demandML?.predict?.({
      dest, date, weatherData: weatherDataForML,
    })
  );

  const { data: railRaw, source: railSource } = railRes;
  const { data: roadRaw, source: roadSource } = roadRes;

  const rail = withSource(railDemand(railRaw, baseline), railSource);

  // §5 degraded-road rule: seat data missing -> frequency-only -> access static
  const degradedRoad = !!roadRaw && roadRaw.seatDataAvailable === false;
  const road = withSource(
    degradedRoad ? roadFrequencyProxy(dest) : null, // no seat-data provider exists; failed road call -> dropped
    roadSource
  );

  const c = dest.railSignalConfidence ?? 0.5;
  let access = accessDemand(rail, road, c);
  if (access) {
    access.source = rail && road ? `${rail.source}+${road.source}` : (rail ?? road).source;
  } else if (clim && clim.access != null) {
    // Access fallback to climatology if both rail and road failed
    access = {
      value: clim.access,
      source: "provider_climatology",
    };
  }

  // Stay component with climatology fallback
  let stay = withSource(stayRes.data ? stayScarcity(stayRes.data, baseline) : null, stayRes.source);
  if (!stay && clim && clim.stay != null) {
    stay = {
      value: clim.stay,
      source: "provider_climatology",
    };
  }

  // Weather component with climatology fallback
  let weather = withSource(weatherPull(wxRes.data), wxRes.source);
  if (!weather && clim && clim.weather != null) {
    weather = {
      value: clim.weather,
      maxTempC: clim.tempC,
      precipMm: clim.precipMm,
      source: "provider_climatology",
    };
  }

  // Capacity component with climatology / seed fallback
  let capacity =
    dest.capacityPrior == null
      ? null
      : { value: dest.capacityPrior, source: "seed" };
  if (!capacity && clim && clim.capacityUtilization != null) {
    capacity = {
      value: clim.capacityUtilization,
      source: "provider_climatology",
    };
  }

  // Formula v3 ML Demand Component
  let demand = null;
  if (demandRes.data && typeof demandRes.data.predictedVisitors === "number") {
    const predictedVisitors = demandRes.data.predictedVisitors;
    const baselineVisitors = getBaselineVisitors(destId, month);
    const demandRatio = predictedVisitors / (baselineVisitors || 1);

    const { k, midpoint } = runtimeConfig.sigmoid;
    const rawSigmoid = 1 / (1 + Math.exp(-k * (demandRatio - midpoint)));
    const demandPressure = Math.max(0, Math.min(1, rawSigmoid));

    demand = {
      value: Math.round(demandPressure * 10000) / 10000,
      predictedVisitors,
      baselineVisitors,
      demandRatio: Math.round(demandRatio * 10000) / 10000,
      source: demandRes.source || "ml_causal",
    };
  }

  return {
    values: {
      access,
      stay,
      calendar: cal,
      weather,
      capacity,
      demand,
    },
    degradedRoad,
  };
}

function withSource(result, source) {
  return result && { ...result, source };
}
