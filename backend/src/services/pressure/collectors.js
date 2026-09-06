// Collectors — fetch side of the Pressure Engine (spec §3).
//
// Calls Nishith's provider adapters, each returning the uniform envelope
// { ok, data, meta }. A failed call (ok:false / throw) means that component is
// dropped by assembleRow — never defaulted (§4).
//
// The adapters don't exist yet. `providers` is injected so this module imports
// cleanly today and the wiring is a one-liner when the provider layer lands.
// Shape expected once it does (every call also gets destId so a mock/adapter
// never has to reverse-lookup from a shared railhead):
//   providers.railradar.arrivals({ destId, railhead, from, to }) -> [{ waitlist }]
//   providers.road.services({ destId, corridor, date })          -> { services:[{freeSeats,totalSeats}], seatDataAvailable }
//   providers.amadeus.hotels({ destId, date })                   -> [{ available, priceINR }]
//   providers.openmeteo.forecast({ destId, lat, lng, date })     -> { maxTempC, precipProb }
//   seed.calendarRow({ date, state })                            -> { kind, label } | null

import {
  railDemand, roadDemand, accessDemand, stayScarcity, calendar, weatherPull,
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

  const [railRaw, roadRaw, hotelsRaw, wxRaw] = await Promise.all([
    unwrap(providers.railradar?.arrivals?.({
      destId: dest._id, railhead: dest.nearestRailhead, from: date, to: date,
    })),
    unwrap(providers.road?.services?.({
      destId: dest._id, corridor: dest.roadAccess?.corridor, date,
    })),
    unwrap(providers.amadeus?.hotels?.({ destId: dest._id, date })),
    unwrap(providers.openmeteo?.forecast?.({
      destId: dest._id, lat: location.lat, lng: location.lng, date,
    })),
  ]);

  const rail = railDemand(railRaw, baseline);

  // §5 degraded-road rule: seat data missing -> frequency-only -> access is
  // no longer date-varying.
  const degradedRoad = !!roadRaw && roadRaw.seatDataAvailable === false;
  const road = degradedRoad ? null : roadDemand(roadRaw?.services, baseline);

  const c = dest.railSignalConfidence ?? 0.5;

  return {
    values: {
      access: accessDemand(rail, road, c),
      stay: stayScarcity(hotelsRaw, baseline),
      calendar: calendar(seed.calendarRow?.({ date, state: dest.state })),
      weather: weatherPull(wxRaw),
      capacity:
        dest.capacityPrior == null
          ? null
          : { value: dest.capacityPrior, source: "seed" },
    },
    degradedRoad,
  };
}
