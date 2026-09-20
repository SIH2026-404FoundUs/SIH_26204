// Runnable self-check for the pressure maths. No framework:  node engine.selfcheck.mjs
import assert from "node:assert/strict";
import {
  composite, assembleRow, weatherPull, WEIGHTS,
  emergingHotspot, normalizedCapacityGap, expectedSupplyFor,
  stayScarcity, roadFrequencyProxy,
} from "./engine.js";
import { spearman, linearRegression } from "./stats.js";

// composite: verbatim §4 renormalise — drop a component, weights rescale to 1
const c = composite([
  { value: 1, weight: 0.45 },
  { value: 0, weight: 0.25 },
]);
assert.ok(Math.abs(c.score - 0.45 / 0.7) < 1e-9, "composite renormalises to sum 1");
assert.equal(composite([]), null, "nothing retrievable -> null, not 0");

// full row, all components present -> date-varying / static split according to WEIGHTS
const full = assembleRow({
  demand: { value: 0.8 }, access: { value: 0.9 }, stay: { value: 0.8 }, calendar: { value: 1 },
  weather: { value: 0.7 }, capacity: { value: 0.6 },
});
const expectedStatic = Math.round(WEIGHTS.capacity * 100) / 100;
const expectedDateVarying = Math.round((1 - WEIGHTS.capacity) * 100) / 100;
assert.equal(full.staticSubtotal, expectedStatic);
assert.equal(full.dateVaryingSubtotal, expectedDateVarying);
assert.deepEqual(full.dropped, []);

// degraded road (§5): access moves to the static bucket
const degraded = assembleRow(
  { demand: { value: 0.8 }, access: { value: 0.9 }, stay: { value: 0.8 }, calendar: { value: 1 },
    weather: { value: 0.7 }, capacity: { value: 0.6 } },
  { degradedRoad: true }
);
const expectedDegradedStatic = Math.round((WEIGHTS.capacity + WEIGHTS.access) * 100) / 100;
assert.equal(degraded.staticSubtotal, expectedDegradedStatic);
assert.deepEqual(degraded.degraded, ["road"]);

// drop > 0.40 of weight -> lowConfidence (drop access)
const dropped = assembleRow({
  access: null, stay: { value: 0.8 }, calendar: { value: 1 },
  weather: { value: 0.7 }, capacity: { value: 0.6 },
});
assert.ok(dropped.dropped.includes("access"));
assert.equal(dropped.lowConfidence, true);

assert.ok(Math.abs(dropped.dateVaryingSubtotal + dropped.staticSubtotal - 1) < 1e-9);

// stay_scarcity: §3 formula on the reduced { unavailFrac, medianPriceINR } signal
const stay = stayScarcity({ unavailFrac: 0.8, medianPriceINR: 4800 }, { hotelMedianINR: 3200 });
assert.ok(Math.abs(stay.value - (0.5 * 0.8 + 0.5 * 1)) < 1e-9, "stay = 0.5*unavail + 0.5*min(price/1.5base,1)");
assert.equal(stayScarcity({ unavailFrac: 0.5 }, { hotelMedianINR: 3200 }), null, "missing price -> null");

// degraded-road proxy: frequency-only -> destination's capacityPrior, flagged
assert.deepEqual(roadFrequencyProxy({ capacityPrior: 0.8 }), { value: 0.8, frequencyOnly: true });
assert.equal(roadFrequencyProxy({ baseline: { roadSeatsAvail: 30 } }), null, "no capacityPrior -> null");
assert.equal(roadFrequencyProxy({}), null);
// access survives on the road proxy alone, and the row is marked static
const roadOnly = assembleRow(
  { access: { value: 0.5 }, stay: { value: 0.6 }, calendar: { value: 0.4 },
    weather: { value: 0.7 }, capacity: { value: 0.5 } },
  { degradedRoad: true }
);
assert.ok(!roadOnly.dropped.includes("access"), "road proxy keeps access alive");

// weather band: pleasant = high, cold+wet = low
assert.equal(weatherPull({ maxTempC: 22, precipProb: 5 }).value, 1);
assert.ok(weatherPull({ maxTempC: 2, precipProb: 90 }).value < 0.2);
assert.equal(weatherPull({ maxTempC: null, precipProb: 5 }), null);

const wsum = Object.values(WEIGHTS).reduce((s, w) => s + w, 0);
assert.ok(Math.abs(wsum - 1) < 1e-3, "weights sum to 1");


// §8 emerging hotspot: rising trend, still below 0.5, real capacity behind it
const rising = [0.2, 0.22, 0.25, 0.28, 0.3, 0.33, 0.36, 0.38, 0.41, 0.43, 0.45, 0.47, 0.48, 0.49];
assert.equal(emergingHotspot(rising, { capacityPrior: 0.7 }).isEmerging, true);
assert.equal(emergingHotspot(rising, { capacityPrior: 0.3 }).isEmerging, false, "no capacity -> not emerging");
assert.equal(emergingHotspot(new Array(14).fill(0.8), { capacityPrior: 0.7 }).isEmerging, false, "flat+high -> not emerging");
assert.ok(linearRegression([1, 2, 3, 4]).slope > 0.99);

// §8 capacity gap: dimensionally consistent, both sides 0..1
const gap = normalizedCapacityGap(0.9, 20, expectedSupplyFor({ expectedSupply: 100 }));
assert.ok(Math.abs(gap.supplyRatio - 0.2) < 1e-9);
assert.ok(Math.abs(gap.normalizedCapacityGap - 0.7) < 1e-9);
assert.equal(normalizedCapacityGap(0.9, 5, expectedSupplyFor({})), null);

// §9 metric: perfect agreement -> 1, perfect reversal -> -1
assert.equal(spearman([1, 2, 3, 4], [10, 20, 30, 40]), 1);
assert.equal(spearman([1, 2, 3, 4], [40, 30, 20, 10]), -1);

console.log("pressureEngine self-check OK");
