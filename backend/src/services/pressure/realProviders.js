// Adapts Nishith's provider adapters to the shape collect() expects.
// Used by the endpoint (service.js) and the precompute job. The back-test keeps
// mockProviders.js for deterministic offline data.
//
// Reality check with no API keys / real seed:
//   - openmeteo : live, needs internet, no key           -> works, else drops
//   - railradar : needs RAILRADAR_API_KEY + seed `trains` -> drops until both exist
//   - road      : pure seed math, frequency-only          -> always works, always degraded (§5)
//   - amadeus   : Nishith ships a seed+calendar ESTIMATE  -> works (estimate:true)

import { getTrainAvailability } from "../../providers/railradar.provider.js";
import { getRoadFrequency } from "../../providers/roadtransport.provider.js";
import { estimateStayScarcity } from "../../providers/stayEstimate.provider.js";
import { getForecast } from "../../providers/openmeteo.provider.js";
import { getDestination } from "../../seeds/index.js";

const compact = (d) => d.replace(/-/g, ""); // "2026-12-26" -> "20261226"

export const realProviders = {
  railradar: {
    // seed needs `trains: [{ number, from }]` per destination; none authored yet.
    arrivals: async ({ destId, from }) => {
      const d = await getDestination(destId);
      const trains = d?.trains ?? [];
      if (!trains.length) return { ok: false, meta: { reason: "no seed train list" } };
      const results = await Promise.all(
        trains.map((t) =>
          getTrainAvailability(t.number, t.from, d.nearestRailhead, compact(from))
        )
      );
      const waitlists = results
        .filter((r) => r.ok)
        .flatMap((r) => r.data.days)
        .filter((day) => String(day.date).startsWith(from) && day.waitlistDepth != null)
        .map((day) => day.waitlistDepth);
      return waitlists.length
        ? { ok: true, data: waitlists.map((w) => ({ waitlist: w })), meta: { source: "railradar" } }
        : { ok: false, meta: { reason: "no waitlist rows for date" } };
    },
  },

  road: {
    // getRoadFrequency is frequency-only by design -> always flag degraded (§5).
    services: async ({ destId }) => {
      const d = await getDestination(destId);
      if (!d) return { ok: false, meta: { reason: "unknown dest" } };
      const r = getRoadFrequency(d);
      return r.ok
        ? { ok: true, data: { seatDataAvailable: false, frequencyPerDay: r.data.frequencyPerDay }, meta: r.meta }
        : r;
    },
  },

  amadeus: {
    hotels: async ({ destId, date, calendarImpact = 0 }) => {
      const d = await getDestination(destId);
      if (!d) return { ok: false, meta: { reason: "unknown dest" } };
      const r = estimateStayScarcity(d, date, calendarImpact);
      return r.ok
        ? { ok: true, data: { unavailFrac: r.data.unavailFrac, medianPriceINR: r.data.medianPriceINR }, meta: r.meta }
        : r;
    },
  },

  openmeteo: {
    forecast: async ({ lat, lng, date }) => {
      const r = await getForecast(lat, lng, date);
      return r.ok
        ? { ok: true, data: { maxTempC: r.data.maxTemp, precipProb: r.data.precipProb }, meta: r.meta }
        : r;
    },
  },
};
