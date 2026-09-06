// STANDS IN for Nishith's provider layer (providers/*.provider.js) only.
// Destination data now comes from the real seed (../../seeds) — this file just
// fakes the live RailRadar / road / Amadeus / Open-Meteo readings until the
// adapters exist. Same { ok, data, meta } envelope they will return.
//
// Delete this file when providers/ is real. Everything else takes `providers`
// by injection, so nothing else changes.

import { getDestination } from "../../seeds/index.js";
import { calendarRow } from "../../seeds/calendar.js";

// deterministic hash -> [0,1): a (keys...) tuple always yields the same reading,
// so the back-test is reproducible.
function rand01(...keys) {
  const s = keys.join("|");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

const festivalBump = (date, state) => {
  const c = calendarRow({ date, state });
  return c.kind === "national" ? 0.35 : c.kind === "state" ? 0.2 : c.kind === "weekend" ? 0.08 : 0;
};

// Synthetic "how sought-after right now" in [0,1]: the seed's hand-authored
// demandPrior + festival bump + date noise. NOT a real signal — a plausible
// stand-in for RailRadar/Amadeus readings. The back-test then checks that the
// full formula can recover the demandPrior ranking through this noise.
function demandFor(dest, date) {
  const base = 0.1 + (dest.demandPrior ?? dest.capacityPrior ?? 0.5) * 0.8;
  const noise = (rand01(dest._id, date) - 0.5) * 0.18;
  return Math.max(0, Math.min(1, base + festivalBump(date, dest.state) + noise));
}

// Corridors where the road adapter can only return departure frequency, not
// seats -> triggers the degraded-road rule (spec §5). A provider-layer fact,
// not a seed fact, so it lives here.
const DEGRADED_CORRIDORS = new Set([
  "chandigarh-manali",
  "bhuntar-kasol",
  "pathankot-dharamshala",
]);

export const mockProviders = {
  railradar: {
    arrivals: async ({ destId, from }) => {
      const d = await getDestination(destId);
      if (!d) return { ok: false, meta: { reason: "unknown dest" } };
      const peak = demandFor(d, from) * 2 * d.baseline.railWL;
      return {
        ok: true,
        data: [1, 0.78, 0.55, 0.3].map((k) => ({ waitlist: Math.round(peak * k) })),
        meta: { source: "mock:railradar" },
      };
    },
  },
  road: {
    services: async ({ destId, date }) => {
      const d = await getDestination(destId);
      if (!d) return { ok: false, meta: { reason: "unknown dest" } };
      if (DEGRADED_CORRIDORS.has(d.roadAccess?.corridor)) {
        return { ok: true, data: { seatDataAvailable: false, departuresPerDay: 12 }, meta: { source: "mock:road" } };
      }
      const occ = demandFor(d, date);
      const total = 40;
      const services = Array.from({ length: 5 }, () => ({
        totalSeats: total,
        freeSeats: Math.max(0, Math.round(total * (1 - occ))),
      }));
      return { ok: true, data: { seatDataAvailable: true, services }, meta: { source: "mock:road" } };
    },
  },
  amadeus: {
    hotels: async ({ destId, date }) => {
      const d = await getDestination(destId);
      if (!d) return { ok: false, meta: { reason: "unknown dest" } };
      const demand = demandFor(d, date);
      const hotels = Array.from({ length: 12 }, (_, i) => ({
        available: rand01(destId, date, i) < demand ? 0 : 1 + Math.floor(rand01(destId, i) * 4),
        priceINR: Math.round(d.baseline.hotelMedianINR * (0.8 + demand * 1.2)),
      }));
      return { ok: true, data: hotels, meta: { source: "mock:amadeus" } };
    },
  },
  openmeteo: {
    forecast: async ({ destId, date, lat }) => {
      const d = await getDestination(destId);
      const y = lat ?? d?.location?.lat ?? 25;
      const maxTempC = (y > 25 ? 12 : 26) + (rand01("wx", destId, date) - 0.5) * 16;
      const precipProb = Math.round(rand01("rain", destId, date) * 60);
      return { ok: true, data: { maxTempC, precipProb }, meta: { source: "mock:open-meteo" } };
    },
  },
};

// Independent footfall ordering for the back-test to correlate against
// (spec §9 step 3). Proxy for a Ministry of Tourism state/monument series.
// Ordering matches the seed's demandPrior (same underlying "how busy" truth a
// real footfall table would reflect) with hand nudges so it is not a clone.
// Replace with a real MoT table before the pitch.
export const FOOTFALL_PROXY = {
  shimla: 96, manali: 90, "ramoji-film-city": 88, kasol: 55, mcleodganj: 63,
  warangal: 48, "nagarjuna-sagar": 38, narkanda: 34, bhongir: 27,
  "tirthan-valley": 24, jibhi: 15, pochampally: 16,
};
