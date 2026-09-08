import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from '../backend/node_modules/dotenv/lib/main.js';
import { connectDB } from '../backend/src/lib/db.js';
import { getPressure } from '../backend/src/services/pressure/service.js';
import { computeWeights, weightedEuclidean } from '../backend/src/services/substitution/distance.js';
import { getStats, getTrackedDestinations, zScore } from '../backend/src/services/substitution/standardize.js';
import { applyAllFilters } from '../backend/src/services/substitution/filters.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Loads all tracked destinations from seed JSON files.
 */
async function loadDestinations() {
  const destinations = getTrackedDestinations();
  console.log(`Loaded ${destinations.length} tracked destinations from JSON seed files.`);
  return destinations;
}

/**
 * Computes pairwise distances across all destinations using uniform attribute weights (weighted Euclidean).
 */
async function computePairwiseDistances(destinations) {
  const n = destinations.length;
  const matrix = Array(n).fill(0).map(() => Array(n).fill(0));
  const flatDistances = [];
  const weights = computeWeights(null); // Uniform weights (1/8 for each attribute)

  const zScores = {};
  for (const dest of destinations) {
    const key = dest._id || dest.id;
    zScores[key] = await zScore(dest);
  }

  for (let i = 0; i < n; i++) {
    const idI = destinations[i]._id || destinations[i].id;
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 0;
        continue;
      }
      const idJ = destinations[j]._id || destinations[j].id;
      const dist = weightedEuclidean(zScores[idI], zScores[idJ], weights);
      matrix[i][j] = dist;
      if (i < j) {
        flatDistances.push(dist);
      }
    }
  }

  return { matrix, flatDistances };
}

/**
 * For each destination, counts how many other destinations have distance <= dStar.
 */
function computeMatchCounts(matrix, dStar) {
  const n = matrix.length;
  const counts = [];
  for (let i = 0; i < n; i++) {
    let count = 0;
    for (let j = 0; j < n; j++) {
      if (i !== j && matrix[i][j] <= dStar) {
        count++;
      }
    }
    counts.push(count);
  }
  return counts;
}

/**
 * Helper to compute percentile of a numeric array.
 */
function getPercentile(arr, p) {
  if (!arr || arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Reports distribution metrics (median, q1, q3, min, max).
 */
function reportDistribution(counts, total) {
  if (!counts || counts.length === 0) {
    return { median: 0, q1: 0, q3: 0, min: 0, max: 0, total };
  }
  return {
    median: Number(getPercentile(counts, 0.5).toFixed(2)),
    q1: Number(getPercentile(counts, 0.25).toFixed(2)),
    q3: Number(getPercentile(counts, 0.75).toFixed(2)),
    min: Math.min(...counts),
    max: Math.max(...counts),
    total
  };
}

/**
 * Tunes dStar by evaluating candidate survival across the FULL PIPELINE (all 3 filters)
 * on peak date 2026-12-26 for high-pressure destinations (P > 0.65).
 * Selects dStar where average surviving alternatives >= 2.0 and as close to 2.5 as possible.
 */
async function tuneDStarForFullPipeline(destinations, pressureFn, travelTimeFn) {
  const dateStr = '2026-12-26';
  const targetAvg = 2.5;

  const hpDests = [];
  for (const d of destinations) {
    const id = d._id || d.id;
    const pRes = await pressureFn(id, dateStr);
    const p = typeof pRes === 'number' ? pRes : (pRes?.score ?? 0.5);
    if (p > 0.65) {
      hpDests.push({ dest: d, pressure: p });
    }
  }

  const activeHpDests = hpDests.length > 0 ? hpDests : destinations.map(d => ({ dest: d, pressure: 0.7 }));

  console.log(`Evaluating full pipeline calibration across ${activeHpDests.length} high-pressure destinations (P > 0.65) on ${dateStr}...`);

  let bestDStarWithMin2 = null;
  let minDiffWithMin2 = Infinity;

  let fallbackDStar = 0.70;
  let minDiffFallback = Infinity;

  for (let d = 0.70; d <= 1.30 + 1e-5; d += 0.05) {
    const dStarVal = Number(d.toFixed(2));
    let totalSurviving = 0;

    for (const hp of activeHpDests) {
      const candidates = destinations.filter(c => (c._id || c.id) !== (hp.dest._id || hp.dest.id));
      const res = await applyAllFilters(
        candidates,
        hp.dest,
        'delhi',
        dateStr,
        dStarVal,
        {},
        pressureFn,
        travelTimeFn
      );
      totalSurviving += res.filtered.length;
    }

    const avgSurviving = totalSurviving / activeHpDests.length;
    const diff = Math.abs(avgSurviving - targetAvg);

    console.log(`  dStar = ${dStarVal.toFixed(2)} => Avg Surviving Alternatives: ${avgSurviving.toFixed(2)}`);

    if (avgSurviving >= 2.0) {
      if (diff < minDiffWithMin2) {
        minDiffWithMin2 = diff;
        bestDStarWithMin2 = dStarVal;
      }
    }

    if (diff < minDiffFallback) {
      minDiffFallback = diff;
      fallbackDStar = dStarVal;
    }
  }

  const calibratedDStar = bestDStarWithMin2 !== null ? bestDStarWithMin2 : fallbackDStar;
  console.log(`Calibrated Full-Pipeline dStar: ${calibratedDStar}`);
  return calibratedDStar;
}

/**
 * Evaluates candidate survival across peak test dates using similarity, reachability, and relief filters.
 */
async function checkPeakDateSurvival(destinations, dStar, pressureStub, travelTimeStub) {
  const peakDates = ['2026-12-26', '2026-12-27', '2026-12-28'];
  const results = {};

  for (const date of peakDates) {
    let totalSurviving = 0;

    for (const dest of destinations) {
      const filtered = await applyAllFilters(
        destinations,
        dest,
        'New Delhi',
        date,
        dStar,
        null,
        pressureStub,
        travelTimeStub
      );
      totalSurviving += filtered.filtered.length;
    }

    const avgSurviving = destinations.length > 0 ? totalSurviving / destinations.length : 0;
    results[date] = {
      avgSurviving: Number(avgSurviving.toFixed(2)),
      totalSurviving
    };
  }

  return results;
}

/**
 * Creates distance histogram with 0.05 bucket intervals up to 2.0.
 */
function createHistogram(flatDistances) {
  const step = 0.05;
  const maxVal = 2.0;
  const numBuckets = Math.ceil(maxVal / step);
  const histogram = [];

  for (let i = 0; i < numBuckets; i++) {
    const binStart = Number((i * step).toFixed(2));
    const binEnd = Number(((i + 1) * step).toFixed(2));
    const count = flatDistances.filter((d) => d >= binStart && d < binEnd).length;
    histogram.push({
      distance: binEnd,
      range: `${binStart} - ${binEnd}`,
      count
    });
  }

  return histogram;
}

/**
 * Saves calibration results to build/distance-histogram.json.
 */
function saveResults(results) {
  const rootDir = path.join(__dirname, '..');
  const buildDir = path.join(rootDir, 'build');
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
  }

  const outputPath = path.join(buildDir, 'distance-histogram.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`Results saved to ${outputPath}`);
}

/**
 * Main calibration runner function.
 */
async function runCalibration() {
  console.log('=== Starting Distance Calibration ===\n');

  try {
    dotenv.config({ path: path.join(__dirname, '../backend/.env') });
    await connectDB();

    const destinations = await loadDestinations();
    if (destinations.length === 0) {
      console.log('No tracked destinations found in database to calibrate.');
      process.exit(1);
    }

    await getStats();
    const { matrix, flatDistances } = await computePairwiseDistances(destinations);

    const travelTimeStub = async () => 10;
    const dStar = await tuneDStarForFullPipeline(destinations, getPressure, travelTimeStub);

    const counts = computeMatchCounts(matrix, dStar);
    const distribution = reportDistribution(counts, destinations.length);
    const histogram = createHistogram(flatDistances);

    const peakSurvival = await checkPeakDateSurvival(destinations, dStar, getPressure, travelTimeStub);

    const results = {
      timestamp: new Date().toISOString(),
      destinationsCount: destinations.length,
      calibratedDStar: dStar,
      distribution,
      peakSurvival,
      histogram
    };

    saveResults(results);

    console.log('\n=== Distance Calibration Summary ===');
    console.log(`Tracked Destinations: ${destinations.length}`);
    console.log(`Calibrated dStar: ${dStar}`);
    console.log(`Match Distribution (Counts per destination):`, distribution);
    console.log(`Peak Date Survival:`, peakSurvival);

    process.exit(0);
  } catch (err) {
    console.error('Calibration Error:', err);
    process.exit(1);
  }
}

runCalibration();
