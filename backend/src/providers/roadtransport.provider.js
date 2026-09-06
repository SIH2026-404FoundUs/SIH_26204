// backend/src/providers/roadtransport.provider.js
import { ok, fail } from '../lib/envelope.js';

// No live seat data exists for this corridor. We report only schedule
// frequency, sourced from Ananya's seed (drawn from published timetables).
// This is honestly labelled low-confidence and estimate:true — never
// presented as observed real-time availability.
function getRoadFrequency(destination) {
  const roadAccess = destination.roadAccess;

  if (!roadAccess || !roadAccess.corridor) {
    return fail('No road corridor data for this destination', { source: 'roadtransport' });
  }

  return ok(
    {
      corridor: roadAccess.corridor,
      operators: roadAccess.operators,
      frequencyPerDay: destination.baseline.roadSeatsAvail  // treat as a proxy, not a seat count
    },
    { source: 'frequency-only', confidence: 'low', estimate: true }
  );
}


export { getRoadFrequency };