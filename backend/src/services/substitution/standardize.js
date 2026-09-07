import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SEEDS_DESTINATIONS_DIR = path.join(__dirname, '../../seeds/destinations');

const ATTR_LIST = [
  'snow',
  'trek',
  'riverside',
  'heritage',
  'nightlife',
  'food',
  'wildlife',
  'spiritual'
];

let statsCache = null;
let cachedDestinations = null;

function loadDestinationsFromJSON() {
  if (!cachedDestinations) {
    try {
      if (!fs.existsSync(SEEDS_DESTINATIONS_DIR)) {
        console.warn(`Seed destinations directory not found at ${SEEDS_DESTINATIONS_DIR}`);
        cachedDestinations = [];
        return cachedDestinations;
      }
      const files = fs.readdirSync(SEEDS_DESTINATIONS_DIR).filter((f) => f.endsWith('.json'));
      cachedDestinations = files.map((file) => {
        const content = fs.readFileSync(path.join(SEEDS_DESTINATIONS_DIR, file), 'utf-8');
        return JSON.parse(content);
      });
    } catch (err) {
      console.error('Error loading destination JSON seeds:', err.message);
      cachedDestinations = [];
    }
  }
  return cachedDestinations;
}

function getTrackedDestinations() {
  return loadDestinationsFromJSON().filter((d) => d.trackingTier === 'tracked');
}

function getDestinationById(id) {
  return loadDestinationsFromJSON().find((d) => d._id === id || d.id === id) || null;
}

/**
 * Initializes and calculates mean (mu) and standard deviation (sigma)
 * for all 8 attributes across all tracked destinations loaded from seed JSON files.
 */
async function initializeStats() {
  const destinations = getTrackedDestinations();

  if (!destinations || destinations.length === 0) {
    throw new Error('No tracked destinations found');
  }

  const count = destinations.length;
  const mu = {};
  const sigma = {};

  for (const attr of ATTR_LIST) {
    const values = destinations.map((dest) => {
      const val = dest.attrs ? dest.attrs[attr] : undefined;
      return val !== undefined && val !== null ? Number(val) : 0;
    });

    const sum = values.reduce((acc, curr) => acc + curr, 0);
    const meanVal = sum / count;
    mu[attr] = meanVal;

    const sqDiffSum = values.reduce((acc, curr) => acc + Math.pow(curr - meanVal, 2), 0);
    let stdDev = Math.sqrt(sqDiffSum / count);

    if (stdDev < 0.05) {
      stdDev = 0.05;
    }

    sigma[attr] = stdDev;
  }

  statsCache = {
    mu,
    sigma,
    attrList: ATTR_LIST,
    count
  };

  console.log(`Substitution stats initialized: ${count} destinations, attributes: [${ATTR_LIST.join(', ')}]`);
  console.log('Mu values:', mu);
  console.log('Sigma values:', sigma);

  return statsCache;
}

/**
 * Returns cached stats or initializes them if not yet loaded.
 */
async function getStats() {
  if (!statsCache) {
    await initializeStats();
  }
  return statsCache;
}

/**
 * Calculates z-scores for a destination document based on stored stats.
 * Formula: (dest.attrs[attr] - stats.mu[attr]) / stats.sigma[attr]
 */
async function zScore(destination) {
  const stats = await getStats();
  const zScores = {};
  const attrs = destination?.attrs || {};

  for (const attr of stats.attrList) {
    const val = attrs[attr];
    if (val === undefined || val === null) {
      console.warn(`Attribute '${attr}' is missing or null for destination '${destination?._id || destination?.displayName || 'unknown'}'. Skipping z-score calculation.`);
      continue;
    }

    const mu = stats.mu[attr];
    const sigma = stats.sigma[attr];
    zScores[attr] = (Number(val) - mu) / sigma;
  }

  return zScores;
}

/**
 * Clears cache and re-fetches stats.
 */
async function reloadStats() {
  statsCache = null;
  cachedDestinations = null;
  return await getStats();
}

// Auto-initialize when module loads
getStats().catch((err) => {
  console.log(`Auto-initialization status: ${err.message}`);
});

export {
  getStats,
  zScore,
  reloadStats,
  initializeStats,
  loadDestinationsFromJSON,
  getTrackedDestinations,
  getDestinationById
};
