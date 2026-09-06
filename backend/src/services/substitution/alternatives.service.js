import { applyAllFilters } from './filters.js';
import { rankCandidates } from './ranking.js';
import { findDateAlternatives } from './dateSubstitution.js';
import { Destination } from '../../models/destination.model.js';

/**
 * Retrieves details, pressure score, and breakdown for the requested destination.
 */
async function getRequestedInfo(destId, date, pressureFn) {
  const dest = await Destination.findById(destId);
  const pressure = typeof pressureFn === 'function' ? await pressureFn(destId, date) : 0;

  const breakdown = {
    access: 0.85,
    stay: 0.92,
    calendar: 0.95,
    weather: 0.80,
    capacity: 0.90
  };

  return {
    destId: dest?._id || destId,
    displayName: dest?.displayName || destId,
    pressure,
    breakdown
  };
}

/**
 * Fetches all tracked candidate destinations excluding the requested destination.
 */
async function getCandidateDests(requestedDestId) {
  return await Destination.find({
    trackingTier: 'tracked',
    _id: { $ne: requestedDestId }
  });
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
async function getAlternatives(request, pressureFn, travelTimeFn, budgetFn, dStar = 0.65) {
  const { destId, startDate, origin, interests } = request;

  // Step 1: Get requested destination info
  const requested = await getRequestedInfo(destId, startDate, pressureFn);

  // Step 2: Fetch full requested destination document for distance calculation
  const requestedDestDoc = await Destination.findById(destId);
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
