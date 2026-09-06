import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Destination } from '../backend/src/models/destination.model.js';
import { calculateDistance, computeWeights } from '../backend/src/services/substitution/distance.js';
import { getStats } from '../backend/src/services/substitution/standardize.js';
import { connectDB } from '../backend/src/lib/db.js';
import { applyAllFilters } from '../backend/src/services/substitution/filters.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../backend/.env') });
dotenv.config({ path: path.join(__dirname, './backend/.env') });
dotenv.config();

/**
 * Connects to MongoDB and fetches all tracked destinations.
 */
async function loadDestinations() {
  await connectDB();
  const destinations = await Destination.find({ trackingTier: 'tracked' });
  console.log(`Loaded ${destinations.length} tracked destinations from database.`);
  return destinations;
}

/**
 * Computes pairwise distances across all destinations using uniform attribute weights.
 */
async function computePairwiseDistances(destinations) {
  const n = destinations.length;
  const matrix = Array(n).fill(0).map(() => Array(n).fill(0));
  const flatDistances = [];
  const weights = computeWeights(null); // Uniform weights (1/8 for each attribute)

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 0;
        continue;
      }
      const dist = await calculateDistance(destinations[i], destinations[j], weights);
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
 * Tunes dStar by testing threshold values from 0.1 to 2.0 to hit target median matches (5-15% of total pool).
 */
function tuneDStar(matrix, total) {
  const targetFraction = 0.10; // Target ~10% candidate match pool
  const targetCount = targetFraction * total;
  let bestDStar = 0.65;
  let minDiff = Infinity;

  for (let d = 0.1; d <= 2.05; d += 0.01) {
    const dStarVal = Number(d.toFixed(2));
    const counts = computeMatchCounts(matrix, dStarVal);
    const med = getPercentile(counts, 0.5);
    const diff = Math.abs(med - targetCount);

    if (diff < minDiff) {
      minDiff = diff;
      bestDStar = dStarVal;
    }
  }

  console.log(`Calibrated dStar: ${bestDStar} (Target match count ~ ${targetCount.toFixed(1)} destinations)`);
  return bestDStar;
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
    const destinations = await loadDestinations();
    if (destinations.length === 0) {
      console.log('No tracked destinations found in database to calibrate.');
      process.exit(1);
    }

    await getStats();
    const { matrix, flatDistances } = await computePairwiseDistances(destinations);

    const dStar = tuneDStar(matrix, destinations.length);
    const counts = computeMatchCounts(matrix, dStar);
    const distribution = reportDistribution(counts, destinations.length);
    const histogram = createHistogram(flatDistances);

    // Stubs for peak date survival check
    const pressureStub = async (destId) => {
      const id = typeof destId === 'object' ? destId._id || destId.id : destId;
      return id === 'manali' ? 0.90 : 0.40;
    };
    const travelTimeStub = async () => 10;

    const peakSurvival = await checkPeakDateSurvival(destinations, dStar, pressureStub, travelTimeStub);

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
