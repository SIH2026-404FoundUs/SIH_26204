// Collectors — fetch side of the Pressure Engine (spec §3).
//
// Calls the provider adapters, each returning the uniform envelope
// { ok, data, meta }. A failed call (ok:false / throw) means that component is
// dropped by assembleRow — never defaulted (§4).
//
// `providers` is injected: services/pressure/realProviders.js wraps Nishith's
// adapters for the endpoint + job; services/pressure/mockProviders.js gives the
// back-test deterministic offline data. Shape each must satisfy:
//   providers.railradar.arrivals({ destId, railhead, from, to }) -> [{ waitlist }]
//   providers.road.services({ destId, corridor, date })          -> { seatDataAvailable, services?:[{freeSeats,totalSeats}] }
//   providers.amadeus.hotels({ destId, date, calendarImpact })   -> { unavailFrac, medianPriceINR }
//   providers.openmeteo.forecast({ destId, lat, lng, date })     -> { maxTempC, precipProb }
//   seed.calendarRow({ date, state })                            -> { value, label } (weekday default)

import {
  railDemand, roadDemand, roadFrequencyProxy, accessDemand,
  stayScarcity, weatherPull,
} from "./engine.js";

// Keeps meta.source alongside data so components can carry provenance (§6
// storage shape: access/stay/weather/capacity all show a `source` field).
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

  // calendar is a local lookup (seed.calendarRow returns the finished
  // { value, label }); the stay estimator needs its value as input
  const cal = seed.calendarRow?.({ date, state: dest.state }) ?? { value: 0.1, label: "weekday" };

  const [railRes, roadRes, stayRes, wxRes] = await Promise.all([
    unwrap(providers.railradar?.arrivals?.({
      destId: dest._id, railhead: dest.nearestRailhead, from: date, to: date,
    })),
    unwrap(providers.road?.services?.({
      destId: dest._id, corridor: dest.roadAccess?.corridor, date,
    })),
    unwrap(providers.amadeus?.hotels?.({
      destId: dest._id, date, calendarImpact: cal.value,
    })),
    unwrap(providers.openmeteo?.forecast?.({
      destId: dest._id, lat: location.lat, lng: location.lng, date,
    })),
  ]);
  const { data: railRaw, source: railSource } = railRes;
  const { data: roadRaw, source: roadSource } = roadRes;

  const rail = withSource(railDemand(railRaw, baseline), railSource);

  // §5 degraded-road rule: seat data missing -> frequency-only -> access is
  // no longer date-varying. Road still contributes its seeded baseline prior.
  const degradedRoad = !!roadRaw && roadRaw.seatDataAvailable === false;
  const road = withSource(
    degradedRoad ? roadFrequencyProxy(dest) : roadDemand(roadRaw?.services, baseline),
    roadSource
  );

  const c = dest.railSignalConfidence ?? 0.5;
  const access = accessDemand(rail, road, c);
  if (access) {
    access.source = rail && road ? `${rail.source}+${road.source}` : (rail ?? road).source;
  }

  return {
    values: {
      access,
      stay: withSource(stayScarcity(stayRes.data, baseline), stayRes.source),
      calendar: cal,
      weather: withSource(weatherPull(wxRes.data), wxRes.source),
      capacity:
        dest.capacityPrior == null
          ? null
          : { value: dest.capacityPrior, source: "seed" },
    },
    degradedRoad,
  };
}

// Attaches provider provenance to a component result without touching engine.js's
// pure maths functions (§6 wants `source` on access/stay/weather, same as capacity).
function withSource(result, source) {
  return result && { ...result, source };
}
