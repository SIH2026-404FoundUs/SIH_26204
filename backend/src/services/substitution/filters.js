import { calculateDistance, computeMahalanobisContext, calculateDistanceWithContext } from './distance.js';
import { getStats } from './standardize.js';
import DestinationPressure from '../../models/destinationPressure.model.js';

async function mapWithConcurrency(items, limit, fn) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const results = new Array(items.length);
  let idx = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = idx++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Prefetches pressure for candidates and requested destination in parallel.
 * Performs a single batch Mongo query (destId $in) for ultra-fast in-memory lookups.
 */
async function prefetchCandidatePressures(candidates, requestedDest, date, pressureFn) {
  const map = new Map();
  const reqId = requestedDest?._id || requestedDest?.id;
  const candIds = Array.isArray(candidates) ? candidates.map((c) => c?._id || c?.id).filter(Boolean) : [];
  const uniqueIds = Array.from(new Set([reqId, ...candIds].filter(Boolean)));

  try {
    const docs = await DestinationPressure.find({
      destId: { $in: uniqueIds },
      date
    }).lean();

    if (docs && docs.length > 0) {
      for (const doc of docs) {
        map.set(String(doc.destId), doc);
      }
    }
  } catch (e) {
    // fallback
  }

  // Fallback for any missing IDs using pressureFn
  const missing = uniqueIds.filter((id) => !map.has(String(id)));
  if (missing.length > 0 && typeof pressureFn === 'function') {
    const fallbackResults = await mapWithConcurrency(missing, 10, (id) => pressureFn(id, date));
    missing.forEach((id, i) => {
      map.set(String(id), fallbackResults[i]);
    });
  }

  return map;
}

/**
 * Filters candidate destinations by attribute similarity distance.
 * Keeps candidates where dist <= dStar and attaches the distance score.
 */
async function filterSimilarity(candidates, requestedDest, dStar, interests, distanceContext = null) {
  if (!Array.isArray(candidates)) return [];

  const context = distanceContext || (await computeMahalanobisContext(interests));
  const filtered = [];
  const reqId = requestedDest?._id || requestedDest?.id;

  for (const candidate of candidates) {
    const candId = candidate?._id || candidate?.id;
    // Exclude requested destination itself
    if (candId && reqId && String(candId) === String(reqId)) {
      continue;
    }

    const dist = await calculateDistanceWithContext(requestedDest, candidate, context);
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

  const candidateTimes = await mapWithConcurrency(candidates, 5, async (candidate) => {
    const candId = candidate._id || candidate.id;
    return travelTimeFn(origin, candId);
  });

  const filtered = [];
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const candidateTime = candidateTimes[i];
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
async function filterRelief(candidates, requestedDest, date, pressureFn, relaxed = false, precomputedPressures = null) {
  if (!Array.isArray(candidates) || typeof pressureFn !== 'function') return [];

  const reqId = requestedDest?._id || requestedDest?.id;
  const reqRes = precomputedPressures && precomputedPressures.has(String(reqId))
    ? precomputedPressures.get(String(reqId))
    : await pressureFn(reqId, date);
  const requestedPressure = typeof reqRes === 'number' ? reqRes : (reqRes?.score ?? 0.5);
  const threshold = relaxed ? 0.20 : 0.30;
  const filtered = [];

  for (const candidate of candidates) {
    const candId = candidate?._id || candidate?.id;
    const candRes = precomputedPressures && precomputedPressures.has(String(candId))
      ? precomputedPressures.get(String(candId))
      : await pressureFn(candId, date);
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

  // Step 1: Precompute Mahalanobis distance context ONCE for all candidates
  const distanceContext = await computeMahalanobisContext(interests);

  // Step 2: Similarity filter
  const similarityFiltered = await filterSimilarity(allCandidates, requestedDest, dStar, interests, distanceContext);

  // Step 3: Reachability filter
  const reachabilityFiltered = await filterReachability(similarityFiltered, origin, requestedDest, travelTimeFn);

  // Step 4: Prefetch pressure scores for candidates ONCE in parallel
  const precomputedPressures = await prefetchCandidatePressures(reachabilityFiltered, requestedDest, date, pressureFn);

  // Step 5: Relief filter (with fallback for relaxed threshold)
  let reliefFiltered = await filterRelief(reachabilityFiltered, requestedDest, date, pressureFn, false, precomputedPressures);
  let relaxedRelief = false;

  if (reliefFiltered.length === 0 && reachabilityFiltered.length > 0) {
    reliefFiltered = await filterRelief(reachabilityFiltered, requestedDest, date, pressureFn, true, precomputedPressures);
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
