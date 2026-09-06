// backend/src/providers/roadtransport.provider.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ok, fail } from '../lib/envelope.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const destinationsDir = path.join(__dirname, '../../test-fixtures/destinations');
function loadDestination(destId) {
  const filePath = path.join(destinationsDir, `${destId.toLowerCase()}.json`);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

// No live seat data exists for this corridor. We report only schedule
// frequency, sourced from Ananya's seed (drawn from published timetables).
// This is honestly labelled low-confidence and estimate:true — never
// presented as observed real-time availability.
function getRoadFrequency(destId) {
  const destination = loadDestination(destId);

  if (!destination) {
    return fail(`No destination data for: ${destId}`, { source: 'roadtransport' });
  }

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
