import { ok, fail } from '../lib/envelope.js';
import fares from '../seeds/fares.json' with { type: 'json' };
// durationMin defaults to 0 so existing callers keep working, but note:
// for mode 'cab' that default silently drops the per-minute component
// and under-quotes the fare. Callers that can supply a trip duration
// (e.g. from a routes/directions leg) should always pass it.
function estimate(city, mode, distanceKm, durationMin = 0) {
  let cityRates = fares[city.toLowerCase()];
  let usedGenericFallback = false;

  // Unknown city -> generic labelled default rather than a hard failure
  // (spec: "unknown cities must NOT hard-fail"). Still an honest estimate,
  // just lower confidence since it isn't calibrated to this specific city.
  if (!cityRates) {
    cityRates = fares.generic;
    usedGenericFallback = true;
    if (!cityRates) {
      return fail(`No fare data for city: ${city}`, { source: 'fareEstimator' });
    }
  }

  const modeRates = cityRates[mode];
  if (!modeRates) {
    return fail(`No fare data for mode: ${mode} in ${city}`, { source: 'fareEstimator' });
  }

  let fareINR;

  if (mode === 'auto') {
    // base + per-km cost, but never below the minimum fare
    fareINR = Math.max(modeRates.minFare, modeRates.base + modeRates.perKm * distanceKm);

  } else if (mode === 'cab') {
    // cabs also charge for time spent in the vehicle, not just distance.
    // perMin is optional in the seed data — treat a missing rate as 0.
    const perMin = modeRates.perMin ?? 0;
    fareINR = Math.max(
      modeRates.minFare,
      modeRates.base + modeRates.perKm * distanceKm + perMin * durationMin
    );

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

  // this is always an estimate, never a live price — mark it as such.
  // A generic-fallback rate isn't calibrated to this city, so it's honestly
  // lower confidence than a city-specific rate.
  const meta = { source: 'fareEstimator', estimate: true, confidence: usedGenericFallback ? 'low' : 'high' };
  if (usedGenericFallback) meta.usedGenericFallback = true;

  // A cab priced with no duration got only the distance component, so the
  // number is a floor, not a full estimate. Flag it here so consumers can
  // tell without re-deriving it from the request inputs.
  if (mode === 'cab' && durationMin === 0) {
    meta.durationIncluded = false;
  }

  return ok({ mode, distanceKm, fareINR: Math.round(fareINR) }, meta);
}


export { estimate };