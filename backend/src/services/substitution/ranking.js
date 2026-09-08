/**
 * Estimates monetary savings (in INR) by substituting requested destination with candidate destination.
 * Formula: requestedBudget.total - candidateBudget.total
 */
async function estimateSaving(requestedDest, candidate, date, budgetFn) {
  if (typeof budgetFn !== 'function') {
    return 0;
  }

  try {
    const reqId = requestedDest?._id || requestedDest?.id;
    const candId = candidate?._id || candidate?.id;

    const requestedBudget = await budgetFn(reqId, date);
    const candidateBudget = await budgetFn(candId, date);

    const reqTotal = requestedBudget && typeof requestedBudget.total === 'number' ? requestedBudget.total : 0;
    const candTotal = candidateBudget && typeof candidateBudget.total === 'number' ? candidateBudget.total : 0;

    return reqTotal - candTotal;
  } catch (err) {
    console.warn(`Failed to estimate budget saving: ${err.message}`);
    return 0;
  }
}

/**
 * Normalizes savings score between 0 and 1 relative to maximum savings in candidate pool.
 * If maxSaving is 0 or unsupplied, defaults to 1 so score multiplier remains neutral.
 */
function normalizeSaving(saving, maxSaving) {
  if (!maxSaving || maxSaving <= 0) {
    return 1;
  }
  const norm = saving / maxSaving;
  return Math.min(1, Math.max(0, norm));
}

/**
 * Computes substitution score for a candidate destination.
 * Formula: score = (1 - d / d*) * (1 - pressureCandidate) * normalizedSaving
 */
async function computeScore(candidate, requestedDest, dStar, pressureFn, date, budgetFn, maxSaving = 0) {
  const candObj = typeof candidate?.toObject === 'function' ? candidate.toObject() : { ...candidate };

  if (candObj.pressure === undefined && typeof pressureFn === 'function') {
    const candId = candObj._id || candObj.id;
    const res = await pressureFn(candId, date);
    candObj.pressure = typeof res === 'number' ? res : (res?.score ?? 0.5);
  }

  const savingINR = await estimateSaving(requestedDest, candObj, date, budgetFn);
  const normalizedSaving = normalizeSaving(savingINR, maxSaving);

  const dist = candObj.distance ?? 0;
  const similarityComponent = Math.min(1, Math.max(0, 1 - dist / dStar));
  const pressureComponent = Math.min(1, Math.max(0, 1 - (candObj.pressure ?? 0)));

  const score = similarityComponent * pressureComponent * normalizedSaving;

  return {
    score,
    savingINR,
    normalizedSaving,
    similarityComponent,
    pressureComponent
  };
}

/**
 * Ranks candidates based on composite substitution score and returns top 3 destinations.
 * Formula: score = (1 - d / d*) * (1 - pressureCandidate) * normalizedSaving
 */
async function rankCandidates(candidates, requestedDest, dStar, date, pressureFn, budgetFn) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return [];
  }

  const processedCandidates = candidates.map((cand) =>
    typeof cand?.toObject === 'function' ? cand.toObject() : { ...cand }
  );

  // Step 1: Compute savings and fetch pressure if missing
  for (const cand of processedCandidates) {
    if (cand.pressure === undefined && typeof pressureFn === 'function') {
      const candId = cand._id || cand.id;
      const res = await pressureFn(candId, date);
      cand.pressure = typeof res === 'number' ? res : (res?.score ?? 0.5);
    }
    if (typeof budgetFn === 'function') {
      const candId = cand._id || cand.id;
      const bRes = await budgetFn(candId, date);
      if (bRes) {
        cand.stayCost = bRes.stayCost || 0;
        cand.transportCost = bRes.transportCost || 0;
        cand.totalCost = bRes.total || 0;
      }
    }
    cand.savingINR = await estimateSaving(requestedDest, cand, date, budgetFn);
  }

  // Step 2: Find max savings across candidates
  const savings = processedCandidates.map((c) => c.savingINR);
  const maxSaving = Math.max(0, ...savings);

  // Step 3: Compute final composite scores
  for (const cand of processedCandidates) {
    cand.normalizedSaving = normalizeSaving(cand.savingINR, maxSaving);

    const dist = cand.distance ?? 0;
    const similarityComponent = Math.min(1, Math.max(0, 1 - dist / dStar));
    const pressureComponent = Math.min(1, Math.max(0, 1 - (cand.pressure ?? 0)));

    cand.score = similarityComponent * pressureComponent * cand.normalizedSaving;
  }

  // Step 4: Sort descending by score
  processedCandidates.sort((a, b) => b.score - a.score);

  // Step 5: Assign rank
  processedCandidates.forEach((cand, idx) => {
    cand.rank = idx + 1;
  });

  // Step 6: Return top 3 candidates
  return processedCandidates.slice(0, 3);
}

export {
  estimateSaving,
  normalizeSaving,
  computeScore,
  rankCandidates
};
