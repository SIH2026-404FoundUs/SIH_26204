import { calculateDistance } from './distance.js';
import { getStats } from './standardize.js';

/**
 * Filters candidate destinations by attribute similarity distance.
 * Keeps candidates where dist <= dStar and attaches the distance score.
 */
async function filterSimilarity(candidates, requestedDest, dStar, interests) {
  if (!Array.isArray(candidates)) return [];

  const filtered = [];
  const reqId = requestedDest?._id || requestedDest?.id;

  for (const candidate of candidates) {
    const candId = candidate?._id || candidate?.id;
    // Exclude requested destination itself
    if (candId && reqId && String(candId) === String(reqId)) {
      continue;
    }

    const dist = await calculateDistance(requestedDest, candidate, interests);
    if (dist <= dStar) {
      const candObj = typeof candidate.toObject === 'function' ? candidate.toObject() : candidate;
      candObj.distance = dist;
      filtered.push(candObj);
    }
  }

  return filtered;
}

/**
 * Filters candidates by reachability.
 * Keeps candidates where travel time <= 1.3 * requested destination travel time.
 * Attaches travelTimeRatio to kept candidates.
 */
async function filterReachability(candidates, origin, requestedDest, travelTimeFn) {
  if (!Array.isArray(candidates) || typeof travelTimeFn !== 'function') return [];

  const requestedId = requestedDest._id || requestedDest.id || requestedDest;
  const requestedTime = await travelTimeFn(origin, requestedId);
  const hasValidReqTime = typeof requestedTime === 'number' && requestedTime > 0;
  const filtered = [];

  for (const candidate of candidates) {
    const candidateTime = await travelTimeFn(origin, candidate._id || candidate.id);
    const hasValidCandTime = typeof candidateTime === 'number' && candidateTime > 0;
    const candObj = typeof candidate.toObject === 'function' ? candidate.toObject() : candidate;

    // Attach raw times for frontend display
    candObj.travelTime = hasValidCandTime ? candidateTime : null;
    candObj.travelTimeHours = hasValidCandTime ? candidateTime : null;
    candObj.requestedTimeHours = hasValidReqTime ? requestedTime : null;

    if (hasValidReqTime && hasValidCandTime) {
      if (candidateTime <= 1.3 * requestedTime) {
        candObj.travelTimeRatio = candidateTime / requestedTime;
        filtered.push(candObj);
      }
    } else if (!hasValidReqTime || !hasValidCandTime) {
      // Fallback when live routing fails for origin or destination:
      // Do NOT set travelTimeRatio to 1. Set to null so UI knows it's a fallback estimate.
      candObj.travelTimeRatio = null;
      candObj.isTravelTimeFallback = true;
      filtered.push(candObj);
    }
  }

  return filtered;
}

/**
 * Filters candidates by pressure relief.
 * Keeps candidates where candidate pressure <= requested pressure - threshold.
 * Threshold is 0.30 by default (-0.30 relief), or 0.20 if relaxed (-0.20 relief).
 * Attaches pressure to kept candidates.
 */
async function filterRelief(candidates, requestedDest, date, pressureFn, relaxed = false) {
  if (!Array.isArray(candidates) || typeof pressureFn !== 'function') return [];

  const reqId = requestedDest?._id || requestedDest?.id;
  const reqRes = await pressureFn(reqId, date);
  const requestedPressure = typeof reqRes === 'number' ? reqRes : (reqRes?.score ?? 0.5);
  const threshold = relaxed ? 0.20 : 0.30;
  const filtered = [];

  for (const candidate of candidates) {
    const candId = candidate?._id || candidate?.id;
    const candRes = await pressureFn(candId, date);
    const candidatePressure = typeof candRes === 'number' ? candRes : (candRes?.score ?? 0.5);

    if (candidatePressure <= requestedPressure - threshold) {
      const candObj = typeof candidate.toObject === 'function' ? candidate.toObject() : candidate;
      candObj.pressure = candidatePressure;
      filtered.push(candObj);
    }
  }

  return filtered;
}

/**
 * Applies Similarity, Reachability, and Relief filters sequentially.
 * If Relief filter produces zero candidates, re-runs Relief filter in relaxed mode (-0.20).
 */
async function applyAllFilters(
  candidates,
  requestedDest,
  origin,
  date,
  dStar,
  interests,
  pressureFn,
  travelTimeFn
) {
  const allCandidates = Array.isArray(candidates) ? candidates : [];

  // Step 1: Similarity filter
  const similarityFiltered = await filterSimilarity(allCandidates, requestedDest, dStar, interests);

  // Step 2: Reachability filter
  const reachabilityFiltered = await filterReachability(similarityFiltered, origin, requestedDest, travelTimeFn);

  // Step 3: Relief filter (with fallback for relaxed threshold)
  let reliefFiltered = await filterRelief(reachabilityFiltered, requestedDest, date, pressureFn, false);
  let relaxedRelief = false;

  if (reliefFiltered.length === 0 && reachabilityFiltered.length > 0) {
    reliefFiltered = await filterRelief(reachabilityFiltered, requestedDest, date, pressureFn, true);
    relaxedRelief = true;
  }

  return {
    filtered: reliefFiltered,
    relaxedRelief: relaxedRelief,
    stats: {
      total: allCandidates.length,
      similarityPassed: similarityFiltered.length,
      reachabilityPassed: reachabilityFiltered.length,
      reliefPassed: reliefFiltered.length
    }
  };
}

export {
  filterSimilarity,
  filterReachability,
  filterRelief,
  applyAllFilters
};
