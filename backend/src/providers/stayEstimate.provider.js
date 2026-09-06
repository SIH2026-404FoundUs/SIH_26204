// backend/src/providers/stayEstimate.provider.js

import { ok } from '../lib/envelope.js';
// Reads Ananya's seeded baseline.hotelMedianINR for a destination,
// and estimates scarcity from calendar pressure instead of live data
function estimateStayScarcity(destination, date, calendarImpact) {
  const medianPrice = destination.baseline.hotelMedianINR;

  // no live data exists, so we estimate: higher calendar impact
  // (festivals, weekends) → assume higher scarcity and price
  const priceMultiplier = 1 + (calendarImpact * 0.4);
  const estimatedPrice = Math.round(medianPrice * priceMultiplier);
  const estimatedUnavailFrac = Math.min(calendarImpact * 0.6, 0.9);

  return ok(
    { medianPriceINR: estimatedPrice, unavailFrac: estimatedUnavailFrac },
    { source: 'seed-estimate', confidence: 'low', estimate: true }
  );
}

export { estimateStayScarcity };
