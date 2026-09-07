import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { applyAllFilters } from './filters.js';
import { rankCandidates } from './ranking.js';
import { findDateAlternatives } from './dateSubstitution.js';
import { getTrackedDestinations, getDestinationById } from './standardize.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HISTOGRAM_PATH = path.join(__dirname, '../../../../build/distance-histogram.json');

function getCalibratedDStar() {
  try {
    if (fs.existsSync(HISTOGRAM_PATH)) {
      const data = JSON.parse(fs.readFileSync(HISTOGRAM_PATH, 'utf8'));
      if (typeof data.calibratedDStar === 'number') {
        return data.calibratedDStar;
      }
    }
  } catch (e) {
    // fallback
  }
  return 1.15;
}

/**
 * Retrieves details, pressure score, and breakdown for the requested destination.
 */
async function getRequestedInfo(destId, date, pressureFn) {
  const dest = getDestinationById(destId);
  const result = typeof pressureFn === 'function' ? await pressureFn(destId, date) : null;

  const pressure = typeof result === 'number' ? result : (result?.score ?? 0.5);

  let breakdown = null;
  if (result && typeof result === 'object' && result.components) {
    const comps = result.components;
    breakdown = {
      access: comps.access?.value ?? 0.5,
      stay: comps.stay?.value ?? 0.5,
      calendar: comps.calendar?.value ?? 0.5,
      weather: comps.weather?.value ?? 0.5,
      capacity: comps.capacity?.value ?? 0.5
    };
  } else {
    breakdown = {
      access: 0.5,
      stay: 0.5,
      calendar: 0.5,
      weather: 0.5,
      capacity: 0.5
    };
  }

  return {
    destId: dest?._id || dest?.id || destId,
    displayName: dest?.displayName || destId,
    pressure,
    breakdown
  };
}

/**
 * Fetches all tracked candidate destinations excluding the requested destination.
 */
async function getCandidateDests(requestedDestId) {
  return getTrackedDestinations().filter(
    (d) => (d._id || d.id) !== requestedDestId
  );
}

/**
 * Formats ranked destination candidates into standard Place response objects.
 */
function buildPlaceResponse(ranked, dStar) {
  if (!Array.isArray(ranked)) return [];

  return ranked.map((candidate) => ({
    destId: candidate._id || candidate.id,
    displayName: candidate.displayName,
    distance: candidate.distance,
    dStar: dStar,
    pressure: candidate.pressure,
    travelTimeRatio: candidate.travelTimeRatio,
    savingINR: candidate.savingINR ?? 0,
    discountSourceBusinessId: candidate.discountSourceBusinessId || null,
    rank: candidate.rank
  }));
}

/**
 * Formats date substitution options into standard Date response objects.
 */
function buildDateResponse(dateResult) {
  if (!dateResult || !Array.isArray(dateResult.dates)) return [];

  return dateResult.dates.map((d) => ({
    startDate: d.date,
    pressure: d.pressure,
    savingINR: d.savingINR ?? 0
  }));
}

/**
 * Main Orchestrator: Receives substitution request, fetches requested info and candidates,
 * applies filters, ranks places, calculates date alternatives, and formats response.
 */
async function getAlternatives(request, pressureFn, travelTimeFn, budgetFn, dStar = getCalibratedDStar()) {
  const { destId, startDate, origin, interests } = request;

  // Step 1: Get requested destination info
  const requested = await getRequestedInfo(destId, startDate, pressureFn);

  // Step 2: Fetch full requested destination document for distance calculation
  const requestedDestDoc = getDestinationById(destId);
  const requestedDestObj = requestedDestDoc || { _id: destId, displayName: requested.displayName };

  // Step 3: Get candidate destinations
  const candidates = await getCandidateDests(destId);

  // Step 4: Apply similarity, reachability, and relief filters
  const filtered = await applyAllFilters(
    candidates,
    requestedDestObj,
    origin,
    startDate,
    dStar,
    interests,
    pressureFn,
    travelTimeFn
  );

  // Step 5: Rank place candidates
  const ranked = await rankCandidates(
    filtered.filtered,
    requestedDestObj,
    dStar,
    startDate,
    pressureFn,
    budgetFn
  );

  // Step 6: Get date alternatives
  const dateResult = await findDateAlternatives(
    requestedDestObj,
    startDate,
    pressureFn,
    budgetFn
  );

  // Step 7: Format responses
  const places = buildPlaceResponse(ranked, dStar);
  const dates = buildDateResponse(dateResult);

  return {
    requested,
    places,
    dates,
    relaxedRelief: filtered.relaxedRelief || false
  };
}

export {
  getRequestedInfo,
  getCandidateDests,
  buildPlaceResponse,
  buildDateResponse,
  getAlternatives
};
