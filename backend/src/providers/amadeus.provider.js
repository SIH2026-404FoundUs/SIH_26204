// Amadeus adapter — intentionally unimplemented, not silently empty.
//
// No AMADEUS_API_KEY/AMADEUS_API_SECRET exist anywhere in this project's
// environment (confirmed: absent from backend/.env), and there is no Amadeus
// SDK call anywhere in the codebase. Rather than fabricate a fake "real"
// integration or return made-up flight/hotel data, this adapter honestly
// reports itself as unavailable via the standard failure envelope.
//
// The pressure engine's stay_scarcity signal does NOT depend on this file —
// it uses stayEstimate.provider.js (seed + calendar based), which is already
// honestly labelled { source: 'seed-estimate', confidence: 'low', estimate: true }
// and never claims to be Amadeus data. See realProviders.js's `amadeus.hotels`
// wrapper for that actual call path.
//
// Wire real Amadeus calls in here (flights, hotel availability, median price)
// once real credentials exist — the envelope shape below is what callers
// should expect either way.

import { fail } from '../lib/envelope.js';

async function searchFlights(_origin, _dest, _date) {
  return fail('Amadeus not configured (no AMADEUS_API_KEY)', { source: 'amadeus' });
}

async function searchHotels(_destId, _checkin, _checkout, _budget) {
  return fail('Amadeus not configured (no AMADEUS_API_KEY)', { source: 'amadeus' });
}

export { searchFlights, searchHotels };
