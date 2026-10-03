import { extractPressureScore } from './standardize.js';
import DestinationPressure from '../../models/destinationPressure.model.js';

/**
 * Scans 14 adjacent dates (-7 to +7 days, excluding requested date 0)
 * and retrieves predicted pressure score for each date.
 */
async function scanDates(destId, requestedDate, pressureFn) {
  const baseDate = new Date(requestedDate + (requestedDate.includes('T') ? '' : 'T00:00:00.000Z'));
  const targetDateStrings = [];

  for (let i = -7; i <= 7; i++) {
    if (i === 0) continue;

    const targetDate = new Date(baseDate.getTime());
    targetDate.setUTCDate(targetDate.getUTCDate() + i);

    const yyyy = targetDate.getUTCFullYear();
    const mm = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(targetDate.getUTCDate()).padStart(2, '0');
    targetDateStrings.push(`${yyyy}-${mm}-${dd}`);
  }

  const rowsMap = new Map();
  try {
    const docs = await DestinationPressure.find({
      destId,
      date: { $in: targetDateStrings }
    }).lean();
    if (docs && docs.length > 0) {
      for (const doc of docs) {
        rowsMap.set(doc.date, doc);
      }
    }
  } catch (e) {
    // fallback
  }

  const results = await Promise.all(
    targetDateStrings.map(async (dateString) => {
      let pressure = 0;
      if (rowsMap.has(dateString)) {
        const res = rowsMap.get(dateString);
        pressure = extractPressureScore(res);
      } else if (typeof pressureFn === 'function') {
        const res = await pressureFn(destId, dateString);
        pressure = extractPressureScore(res);
      }
      return { date: dateString, pressure };
    })
  );

  results.sort((a, b) => a.date.localeCompare(b.date));
  return results;
}

/**
 * Fallback Level 1: Significant relief filter (pressure <= basePressure - 0.25).
 */
function attempt1(dates, basePressure) {
  if (!Array.isArray(dates)) return [];
  return dates.filter((d) => d.pressure <= basePressure - 0.25);
}

/**
 * Fallback Level 2: Moderate relief filter (pressure <= basePressure - 0.15).
 */
function attempt2(dates, basePressure) {
  if (!Array.isArray(dates)) return [];
  return dates.filter((d) => d.pressure <= basePressure - 0.15);
}

/**
 * Fallback Level 3: Modest relief filter (returns single date with lowest pressure).
 */
function attempt3(dates) {
  if (!Array.isArray(dates) || dates.length === 0) return [];
  let lowest = dates[0];
  for (let i = 1; i < dates.length; i++) {
    if (dates[i].pressure < lowest.pressure) {
      lowest = dates[i];
    }
  }
  return [lowest];
}

/**
 * Estimates budget savings (in INR) between visiting on requestedDate vs alternative date2.
 */
async function estimateDateSaving(destId, date1, date2, budgetFn) {
  if (typeof budgetFn !== 'function') return 0;

  try {
    const budget1 = await budgetFn(destId, date1);
    const budget2 = await budgetFn(destId, date2);

    const total1 = budget1 && typeof budget1.total === 'number' ? budget1.total : 0;
    const total2 = budget2 && typeof budget2.total === 'number' ? budget2.total : 0;

    return total1 - total2;
  } catch (err) {
    console.warn(`Failed to estimate date savings: ${err.message}`);
    return 0;
  }
}

/**
 * Ranks date options based on pressure drop (60% weight) and budget savings (40% weight).
 * Score = (pressureDrop * 0.6) + (normalizedSaving * 0.4)
 */
async function rankDateOptions(dates, requestedDest, requestedDate, budgetFn, basePressure) {
  if (!Array.isArray(dates) || dates.length === 0) return [];

  const destId = requestedDest?._id || requestedDest?.id || requestedDest;
  const processedDates = dates.map((d) => ({ ...d }));

  // Step 1: Compute savings and pressure drop
  for (const dateObj of processedDates) {
    dateObj.pressureDrop = basePressure - dateObj.pressure;
    dateObj.savingINR = await estimateDateSaving(destId, requestedDate, dateObj.date, budgetFn);
  }

  // Step 2: Normalize savings
  const maxSaving = Math.max(0, ...processedDates.map((d) => d.savingINR));

  for (const dateObj of processedDates) {
    if (maxSaving > 0) {
      const norm = dateObj.savingINR / maxSaving;
      dateObj.normalizedSaving = Math.min(1, Math.max(0, norm));
    } else {
      dateObj.normalizedSaving = 1;
    }

    const dropNorm = Math.max(0, dateObj.pressureDrop);
    dateObj.score = dropNorm * 0.6 + dateObj.normalizedSaving * 0.4;
  }

  // Step 3: Sort by score descending
  processedDates.sort((a, b) => b.score - a.score);

  // Step 4: Return top 2 dates
  return processedDates.slice(0, 2);
}

/**
 * Main entry point for temporal substitution: scans +/- 7 days and applies fallback ladder
 * to find optimal alternative dates with lower pressure and cost savings.
 */
async function findDateAlternatives(requestedDest, requestedDate, pressureFn, budgetFn) {
  const destId = requestedDest?._id || requestedDest?.id || requestedDest;
  let basePressure = 0;

  if (typeof pressureFn === 'function') {
    const res = await pressureFn(destId, requestedDate);
    basePressure = extractPressureScore(res);
  }

  const allDates = await scanDates(destId, requestedDate, pressureFn);

  let filteredDates = [];
  let attemptLevel = 1;
  let defaultLabel = '';

  // Fallback Ladder Evaluation
  const attempt1Result = attempt1(allDates, basePressure);
  if (attempt1Result.length > 0) {
    filteredDates = attempt1Result;
    attemptLevel = 1;
    defaultLabel = 'Significant relief';
  } else {
    const attempt2Result = attempt2(allDates, basePressure);
    if (attempt2Result.length > 0) {
      filteredDates = attempt2Result;
      attemptLevel = 2;
      defaultLabel = 'Moderate relief';
    } else {
      filteredDates = attempt3(allDates);
      attemptLevel = 3;
      const drop = filteredDates[0] ? basePressure - filteredDates[0].pressure : 0;
      defaultLabel = `Modest relief: ${drop.toFixed(2)} lower pressure`;
    }
  }

  // Rank dates
  const rankedDates = await rankDateOptions(
    filteredDates,
    requestedDest,
    requestedDate,
    budgetFn,
    basePressure
  );

  // Build labels map
  const labels = {};
  for (const d of rankedDates) {
    if (attemptLevel === 3) {
      const drop = d.pressureDrop !== undefined ? d.pressureDrop : 0;
      labels[d.date] = `Modest relief: ${drop.toFixed(2)} lower pressure`;
    } else {
      labels[d.date] = defaultLabel;
    }
  }

  return {
    dates: rankedDates,
    attemptLevel,
    labels
  };
}

export {
  scanDates,
  attempt1,
  attempt2,
  attempt3,
  estimateDateSaving,
  rankDateOptions,
  findDateAlternatives
};
