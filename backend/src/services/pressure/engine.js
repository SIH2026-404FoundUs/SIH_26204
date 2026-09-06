// Pressure Engine — the locked formula from spec §2, the drop-and-renormalise
// rule from §4, and the degraded-road rule from §5.
//
// This file is pure: it turns already-fetched provider data into a stored row.
// Fetching lives in collectors.js (calls Nishith's provider adapters).
// Nothing here does I/O, so the maths is testable today, before the adapters
// and Ananya's seed exist.

import { linearRegression } from "./stats.js";

// --- Locked weights (§2). Do not change without telling the team — Madhuri's
// calibration and the back-test both assume these exact numbers.
export const WEIGHTS = {
  access: 0.45, // DATE-VARYING (becomes STATIC when road is degraded, §5)
  stay: 0.25, // DATE-VARYING
  calendar: 0.1, // DATE-VARYING
  weather: 0.1, // DATE-VARYING
  capacity: 0.1, // STATIC by definition
};
const STATIC_KEYS = new Set(["capacity"]);
const clamp01 = (x) => Math.max(0, Math.min(1, x));

// --- Per-component normalisation to [0,1] against dest.baseline (§3).
// Each takes provider data + the dest row, returns { value, ...meta } or null
// (null = signal not retrievable -> component is dropped, never defaulted).

export function railDemand(services, baseline) {
  // mean waitlist depth of the top-3 most-subscribed arriving services
  if (!services?.length || baseline?.railWL == null) return null;
  const top3 = [...services].sort((a, b) => b.waitlist - a.waitlist).slice(0, 3);
  const raw = top3.reduce((s, x) => s + x.waitlist, 0) / top3.length;
  return { value: clamp01(raw / (2 * baseline.railWL)), meanTop3WL: raw };
}

export function roadDemand(services, baseline) {
  // occupancy across corridor services on the date
  if (!services?.length || baseline?.roadSeatsAvail == null) return null;
  const free = services.reduce((s, x) => s + x.freeSeats, 0);
  const total = services.reduce((s, x) => s + x.totalSeats, 0);
  if (total === 0) return null;
  const raw = 1 - free / total;
  // ponytail: baseline.roadSeatsAvail treated as the baseline *ratio*. Confirm
  // its unit with Ananya once the seed lands; that's the calibration knob here.
  const baseRatio = baseline.roadSeatsAvail > 1
    ? 1 - baseline.roadSeatsAvail / total // count -> ratio fallback
    : baseline.roadSeatsAvail;
  return { value: clamp01(raw / (baseRatio || 1)), occupancy: raw };
}

// access is ONE component: c-blend of rail and road (§2). Handles partial failure
// per §4: if only one side fails, lean fully on the survivor; if both fail -> null.
export function accessDemand(rail, road, c) {
  if (rail && road) {
    return { value: clamp01(c * rail.value + (1 - c) * road.value),
             rail: rail.value, road: road.value, c };
  }
  if (rail) return { value: rail.value, rail: rail.value, road: null, c: 1 };
  if (road) return { value: road.value, rail: null, road: road.value, c: 0 };
  return null;
}

export function stayScarcity(hotels, baseline) {
  if (!hotels?.length || baseline?.hotelMedianINR == null) return null;
  const unavailFrac =
    hotels.filter((h) => h.available === 0).length / hotels.length;
  const prices = hotels.map((h) => h.priceINR).filter((p) => p > 0).sort((a, b) => a - b);
  const median = prices.length
    ? prices[Math.floor(prices.length / 2)]
    : baseline.hotelMedianINR;
  const priceRatio = median / baseline.hotelMedianINR;
  const value = 0.5 * unavailFrac + 0.5 * clamp01(median / (1.5 * baseline.hotelMedianINR));
  return { value, unavailFrac, priceRatio };
}

// calendar: row from Ananya's seeds/calendar.json, keyed by date+state (§3).
export function calendar(row) {
  const table = { national: 1.0, state: 0.7, weekend: 0.4, weekday: 0.1 };
  const kind = row?.kind ?? "weekday"; // default when no row matches
  return { value: table[kind] ?? 0.1, label: row?.label ?? kind };
}

// weather_pull: pleasantness raises intent to travel, so it raises pressure (§3).
export function weatherPull(wx) {
  if (!wx || wx.maxTempC == null || wx.precipProb == null) return null;
  const t = wx.maxTempC;
  // 1.0 inside [15,28]C, falling linearly to 0 by +/-7C outside the band
  const tempScore =
    t >= 15 && t <= 28 ? 1 : clamp01(1 - (t < 15 ? 15 - t : t - 28) / 7);
  const rainScore = wx.precipProb < 20 ? 1 : clamp01(1 - (wx.precipProb - 20) / 50);
  return { value: tempScore * rainScore, maxTempC: t, precipProb: wx.precipProb };
}

// --- Drop-and-renormalise (§4, verbatim). parts = present components only.
export function composite(parts) {
  const total = parts.reduce((s, p) => s + p.weight, 0);
  if (total === 0) return null; // nothing retrievable -> no score, not zero
  const score = parts.reduce((s, p) => s + p.value * (p.weight / total), 0);
  return { score, effectiveWeights: parts.map((p) => p.weight / total) };
}

/**
 * Assemble the full stored row (§6) from raw component values.
 * @param {object} values  { access, stay, calendar, weather, capacity } — each
 *                          { value, ...meta } or null/undefined if unavailable.
 * @param {object} opts     { degradedRoad: boolean } — road returned frequency
 *                          -only, so access no longer varies by date (§5).
 */
export function assembleRow(values, { degradedRoad = false } = {}) {
  const present = [];
  const components = {};
  const dropped = [];

  for (const key of Object.keys(WEIGHTS)) {
    const v = values[key];
    if (v && v.value != null) {
      const c = { ...v, weight: WEIGHTS[key] };
      components[key] = c;
      present.push({ key, value: v.value, weight: WEIGHTS[key] });
    } else {
      dropped.push(key);
    }
  }

  const comp = composite(present.map(({ value, weight }) => ({ value, weight })));
  if (!comp) {
    return { score: null, components, dropped, degraded: degradedRoad ? ["road"] : [],
             dateVaryingSubtotal: 0, staticSubtotal: 0, lowConfidence: true };
  }

  // effective weight split into date-varying vs static buckets.
  // When road is degraded, access moves from the date-varying bucket to static.
  let dateVarying = 0;
  let staticSub = 0;
  present.forEach(({ key }, i) => {
    const w = comp.effectiveWeights[i];
    const isStatic = STATIC_KEYS.has(key) || (degradedRoad && key === "access");
    if (isStatic) staticSub += w;
    else dateVarying += w;
  });

  const droppedWeight = dropped.reduce((s, k) => s + WEIGHTS[k], 0);
  const lowConfidence = droppedWeight > 0.4; // §4: >0.40 of total weight dropped

  return {
    score: comp.score,
    components,
    dateVaryingSubtotal: round2(dateVarying),
    staticSubtotal: round2(staticSub),
    dropped,
    degraded: degradedRoad ? ["road"] : [],
    lowConfidence,
  };
}

const round2 = (x) => Math.round(x * 100) / 100;

// --- §8 Emerging hotspot + normalised capacity gap. Both need history, which
// only exists once the precompute job has run for ~14 days (or Ananya's backfill).

/**
 * A destination trending up but not yet saturated, with real capacity behind it.
 * @param {number[]} last14Scores  daily `score` for this dest, oldest -> newest
 * @param {object} dest            needs capacityPrior
 */
export function emergingHotspot(last14Scores, dest) {
  const { slope } = linearRegression(last14Scores);
  const currentScore = last14Scores[last14Scores.length - 1] ?? 0;
  return {
    slope,
    isEmerging:
      slope > 0.02 && currentScore < 0.5 && (dest?.capacityPrior ?? 0) > 0.5,
  };
}

// expected bookable units for a destination — spec §8 `expectedSupplyFor(dest)`.
// Authored in Ananya's seed as `expectedSupply`.
export const expectedSupplyFor = (dest) => dest?.expectedSupply ?? null;

/**
 * normalizedCapacityGap = pressure - supplyRatio, both on 0..1 so they subtract
 * cleanly (spec §8). NOT the same as Bharani's raw-room-count roomDemandGap.
 * @param {number} pressure         the 0..1 score
 * @param {number} bookableSupply   raw count of bookable units for the dest/date
 * @param {number} expectedSupply   from expectedSupplyFor(dest)
 */
export function normalizedCapacityGap(pressure, bookableSupply, expectedSupply) {
  if (!expectedSupply) return null;
  const supplyRatio = clamp01(bookableSupply / expectedSupply);
  return { normalizedCapacityGap: pressure - supplyRatio, supplyRatio };
}
