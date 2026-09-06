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

const unwrap = async (p) => {
  try {
    const r = await p;
    return r && r.ok ? r.data : null;
  } catch {
    return null;
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

  const [railRaw, roadRaw, stayRaw, wxRaw] = await Promise.all([
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

  const rail = railDemand(railRaw, baseline);

  // §5 degraded-road rule: seat data missing -> frequency-only -> access is
  // no longer date-varying. Road still contributes its seeded baseline prior.
  const degradedRoad = !!roadRaw && roadRaw.seatDataAvailable === false;
  const road = degradedRoad
    ? roadFrequencyProxy(dest)
    : roadDemand(roadRaw?.services, baseline);

  const c = dest.railSignalConfidence ?? 0.5;

  return {
    values: {
      access: accessDemand(rail, road, c),
      stay: stayScarcity(stayRaw, baseline),
      calendar: cal,
      weather: weatherPull(wxRaw),
      capacity:
        dest.capacityPrior == null
          ? null
          : { value: dest.capacityPrior, source: "seed" },
    },
    degradedRoad,
  };
}
