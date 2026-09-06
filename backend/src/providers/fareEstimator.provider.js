import { ok, fail } from '../lib/envelope.js';
import fares from '../seeds/fares.json' with { type: 'json' };
function estimate(city, mode, distanceKm) {
  const cityRates = fares[city.toLowerCase()];

  // if we don't have rates for this city, be honest, don't guess
  if (!cityRates) {
    return fail(`No fare data for city: ${city}`, { source: 'fareEstimator' });
  }

  const modeRates = cityRates[mode];
  if (!modeRates) {
    return fail(`No fare data for mode: ${mode} in ${city}`, { source: 'fareEstimator' });
  }

  let fareINR;

  if (mode === 'auto' || mode === 'cab') {
    // base + per-km cost, but never below the minimum fare
    fareINR = Math.max(modeRates.minFare, modeRates.base + modeRates.perKm * distanceKm);

  } else if (mode === 'metro') {
    // slabs are [maxDistanceForThisPrice, price] pairs, in order —
    // find the first slab whose distance limit covers our trip
    const slab = modeRates.slabs.find(([maxKm]) => distanceKm <= maxKm);
    fareINR = slab ? slab[1] : modeRates.slabs[modeRates.slabs.length - 1][1];

  } else if (mode === 'bus') {
    fareINR = modeRates.flat;

  } else {
    return fail(`Unknown mode: ${mode}`, { source: 'fareEstimator' });
  }

  // this is always an estimate, never a live price — mark it as such
  return ok(
    { mode, distanceKm, fareINR: Math.round(fareINR) },
    { source: 'fareEstimator', estimate: true, confidence: 'high' }
  );
}


export { estimate };