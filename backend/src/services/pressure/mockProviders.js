// STANDS IN for Nishith's provider layer, for the back-test only (the endpoint
// and job use realProviders.js). Deterministic so the back-test is reproducible.
// Destination + calendar data is Ananya's real seed via seed.js.

import { getDestination, calendarRow } from "./seed.js";

// deterministic hash -> [0,1): a (keys...) tuple always yields the same reading.
function rand01(...keys) {
  const s = keys.join("|");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

// calendar impact (0..1) -> a demand bump
const festivalBump = (date, state) => {
  const { value } = calendarRow({ date, state });
  return value >= 0.85 ? 0.35 : value >= 0.6 ? 0.2 : value >= 0.35 ? 0.08 : 0;
};

// Synthetic "how sought-after right now" in [0,1]: capacityPrior + festival bump
// + date noise. NOT a real signal — a plausible stand-in. The back-test checks
// the formula can recover the capacityPrior/footfall ranking through this noise.
function demandFor(dest, date) {
  const base = 0.1 + (dest.capacityPrior ?? 0.5) * 0.8;
  const noise = (rand01(dest._id, date) - 0.5) * 0.18;
  return Math.max(0, Math.min(1, base + festivalBump(date, dest.state) + noise));
}

// Each mock reading is shaped so its component normalises back to ~demandFor,
// keeping the back-test a clean test of "does the weighted blend + renormalise
// preserve the demand ranking". Real providers bring the real signal + noise.
export const mockProviders = {
  railradar: {
    arrivals: async ({ destId, from }) => {
      const d = getDestination(destId);
      if (!d) return { ok: false, meta: { reason: "unknown dest" } };
      // 3 equal waitlists whose mean normalises to demandFor in railDemand()
      const wl = Math.round(demandFor(d, from) * 2 * d.baseline.railWL);
      return {
        ok: true,
        data: [wl, wl, wl].map((w) => ({ waitlist: w })),
        meta: { source: "mock:railradar" },
      };
    },
  },
  road: {
    // frequency-only for every dest — matches Nishith's real adapter, so the
    // degraded-road rule (§5) fires everywhere and access uses capacityPrior.
    services: async ({ destId }) => {
      const d = getDestination(destId);
      if (!d) return { ok: false, meta: { reason: "unknown dest" } };
      return { ok: true, data: { seatDataAvailable: false, frequencyPerDay: 12 }, meta: { source: "mock:road" } };
    },
  },
  amadeus: {
    // reduced signal { unavailFrac, medianPriceINR } — same shape as Nishith's
    // stayEstimate.provider.js
    hotels: async ({ destId, date }) => {
      const d = getDestination(destId);
      if (!d) return { ok: false, meta: { reason: "unknown dest" } };
      const demand = demandFor(d, date);
      return {
        ok: true,
        data: {
          unavailFrac: demand,
          medianPriceINR: Math.round(d.baseline.hotelMedianINR * 1.5 * demand),
        },
        meta: { source: "mock:amadeus" },
      };
    },
  },
  openmeteo: {
    // benign weather for every dest — near-constant so it doesn't scramble the
    // mock ranking. Real weather variation is tested with the real provider.
    forecast: async () => ({
      ok: true,
      data: { maxTempC: 22, precipProb: 10 },
      meta: { source: "mock:open-meteo" },
    }),
  },
};

// Independent footfall ordering for the back-test to correlate against (§9 step 3).
// Hand-ranked proxy for a Ministry of Tourism state/monument series — 8-10 dests
// across both states, >=2 saturated and >=2 quiet. Replace with a real table.
export const FOOTFALL_PROXY = {
  "charminar-hyderabad": 95,
  manali: 90,
  shimla: 85,
  "hussain-sagar-hyderabad": 80,
  "golconda-hyderabad": 76,
  mcleodganj: 68,
  kasol: 58,
  dharamshala: 50,
  "nagarjuna-sagar": 40,
  "warangal-fort": 36,
  "tirthan-valley": 24,
  jibhi: 18,
};
