import { getStats, zScore } from './standardize.js';
import { loadDestinations } from '../pressure/seed.js';

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

/**
 * Computes attribute weights based on user interests.
 * Formula: weight = 0.6 * normalizedInterest + 0.4 * (1/8)
 */
function computeWeights(interests) {
  const weights = {};
  const hasInterests = interests && typeof interests === 'object' && Object.keys(interests).length > 0;

  const rawInterests = {};
  let sumRaw = 0;

  for (const attr of ATTR_LIST) {
    let val;
    if (!hasInterests) {
      val = 0.5;
    } else {
      val = interests[attr] !== undefined && interests[attr] !== null ? Number(interests[attr]) : 0;
    }
    rawInterests[attr] = val;
    sumRaw += val;
  }

  for (const attr of ATTR_LIST) {
    const normalizedInterest = sumRaw > 0 ? rawInterests[attr] / sumRaw : 1 / 8;
    weights[attr] = 0.6 * normalizedInterest + 0.4 * (1 / 8);
  }

  return weights;
}

/**
 * Computes weighted Euclidean distance between two z-score objects.
 * Formula: sqrt( sum( weights[attr] * (zA[attr] - zB[attr])^2 ) )
 */
function weightedEuclidean(zA, zB, weights) {
  let sum = 0;
  for (const attr of ATTR_LIST) {
    if (zA[attr] === undefined || zA[attr] === null || zB[attr] === undefined || zB[attr] === null) {
      continue;
    }
    const w = weights && weights[attr] !== undefined ? weights[attr] : 1 / 8;
    const diff = zA[attr] - zB[attr];
    sum += w * diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Computes Pearson correlation matrix (8x8) across all tracked destinations.
 */
function computeCorrelationMatrix(destinations) {
  const n = destinations.length;
  const matrix = Array(ATTR_LIST.length).fill(0).map(() => Array(ATTR_LIST.length).fill(0));

  if (n === 0) return matrix;

  const means = {};
  for (const attr of ATTR_LIST) {
    const sum = destinations.reduce((acc, d) => acc + (d.attrs?.[attr] ?? 0), 0);
    means[attr] = sum / n;
  }

  for (let i = 0; i < ATTR_LIST.length; i++) {
    for (let j = 0; j < ATTR_LIST.length; j++) {
      if (i === j) {
        matrix[i][j] = 1.0;
        continue;
      }
      const attrA = ATTR_LIST[i];
      const attrB = ATTR_LIST[j];
      const meanA = means[attrA];
      const meanB = means[attrB];

      let num = 0;
      let denA = 0;
      let denB = 0;

      for (const dest of destinations) {
        const valA = dest.attrs?.[attrA] ?? 0;
        const valB = dest.attrs?.[attrB] ?? 0;
        const diffA = valA - meanA;
        const diffB = valB - meanB;

        num += diffA * diffB;
        denA += diffA * diffA;
        denB += diffB * diffB;
      }

      const denom = Math.sqrt(denA * denB);
      matrix[i][j] = denom > 1e-10 ? num / denom : 0;
    }
  }

  return matrix;
}

/**
 * Determines whether to use Mahalanobis distance based on correlation threshold (> 0.6).
 */
function shouldUseMahalanobis(destinations) {
  const corrMatrix = computeCorrelationMatrix(destinations);
  let useMahalanobis = false;

  for (let i = 0; i < ATTR_LIST.length; i++) {
    for (let j = 0; j < ATTR_LIST.length; j++) {
      if (i !== j && corrMatrix[i][j] > 0.6) {
        useMahalanobis = true;
        break;
      }
    }
    if (useMahalanobis) break;
  }

  return useMahalanobis;
}

/**
 * Computes 8x8 covariance matrix across tracked destinations using mu values from getStats().
 */
async function computeCovarianceMatrix(destinations) {
  const n = destinations.length;
  const divisor = n > 1 ? n - 1 : 1;

  // Convert ALL destinations to z-scores FIRST
  const zDests = [];
  for (const dest of destinations) {
    const z = await zScore(dest);
    zDests.push(z);
  }

  // Calculate sample means of z-scores for each attribute
  const zMeans = {};
  for (const attr of ATTR_LIST) {
    const sum = zDests.reduce((acc, z) => acc + (z[attr] ?? 0), 0);
    zMeans[attr] = sum / n;
  }

  const matrix = Array(ATTR_LIST.length).fill(0).map(() => Array(ATTR_LIST.length).fill(0));

  for (let i = 0; i < ATTR_LIST.length; i++) {
    for (let j = 0; j < ATTR_LIST.length; j++) {
      const attrI = ATTR_LIST[i];
      const attrJ = ATTR_LIST[j];
      const meanI = zMeans[attrI];
      const meanJ = zMeans[attrJ];

      let sum = 0;
      for (const z of zDests) {
        const valI = z[attrI] ?? 0;
        const valJ = z[attrJ] ?? 0;
        sum += (valI - meanI) * (valJ - meanJ);
      }

      let covVal = sum / divisor;
      // Add slight regularization on diagonal for numerical stability of inverse
      if (i === j) {
        covVal += 1e-6;
      }
      matrix[i][j] = covVal;
    }
  }

  return matrix;
}

/**
 * Inverts an 8x8 matrix using Gaussian elimination with partial pivoting.
 */
function invertMatrix(matrix) {
  const n = matrix.length;
  // Create augmented matrix [A | I]
  const aug = matrix.map((row, i) => [
    ...row,
    ...Array(n).fill(0).map((_, j) => (i === j ? 1 : 0))
  ]);

  // Gaussian elimination with partial pivoting
  for (let col = 0; col < n; col++) {
    // Find pivot row
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) {
        maxRow = row;
      }
    }
    // Swap rows
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-10) {
      throw new Error('Matrix is singular');
    }

    // Normalize pivot row
    for (let j = col; j < 2 * n; j++) {
      aug[col][j] /= pivot;
    }

    // Eliminate other rows
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = aug[row][col];
      for (let j = col; j < 2 * n; j++) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }

  // Extract inverse from right side
  return aug.map((row) => row.slice(n));
}

/**
 * Helper: Standard matrix multiplication (A * B).
 */
function matrixMultiply(A, B) {
  const rowsA = A.length;
  const colsA = A[0].length;
  const rowsB = B.length;
  const colsB = B[0].length;

  if (colsA !== rowsB) {
    throw new Error(`Cannot multiply matrices: columns of A (${colsA}) != rows of B (${rowsB})`);
  }

  const result = Array(rowsA).fill(0).map(() => Array(colsB).fill(0));
  for (let i = 0; i < rowsA; i++) {
    for (let j = 0; j < colsB; j++) {
      for (let k = 0; k < colsA; k++) {
        result[i][j] += A[i][k] * B[k][j];
      }
    }
  }
  return result;
}

/**
 * Helper: Converts 1D array to column matrix (N x 1).
 */
function arrayToMatrix(array) {
  return array.map((val) => [val]);
}

/**
 * Helper: Transposes a matrix.
 */
function matrixTranspose(A) {
  const rows = A.length;
  const cols = A[0].length;
  const transposed = Array(cols).fill(0).map(() => Array(rows).fill(0));
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      transposed[j][i] = A[i][j];
    }
  }
  return transposed;
}

/**
 * Helper: Computes determinant of a matrix (optional, for checking).
 */
function determinant(matrix) {
  const n = matrix.length;
  if (n === 1) return matrix[0][0];
  if (n === 2) return matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
  let det = 0;
  for (let col = 0; col < n; col++) {
    const subMatrix = matrix.slice(1).map((row) => row.filter((_, j) => j !== col));
    const sign = col % 2 === 0 ? 1 : -1;
    det += sign * matrix[0][col] * determinant(subMatrix);
  }
  return det;
}

/**
 * Computes Mahalanobis distance between two z-score objects using inverse covariance matrix.
 * Formula: sqrt( diff^T * invCov * diff )
 */
function mahalanobis(zA, zB, invCov) {
  const diff = ATTR_LIST.map((attr) => {
    const valA = zA && zA[attr] !== undefined && zA[attr] !== null ? zA[attr] : 0;
    const valB = zB && zB[attr] !== undefined && zB[attr] !== null ? zB[attr] : 0;
    return valA - valB;
  });

  const diffCol = arrayToMatrix(diff);
  const diffRow = matrixTranspose(diffCol);

  const temp = matrixMultiply(invCov, diffCol);
  const resultMatrix = matrixMultiply(diffRow, temp);

  const val = resultMatrix[0][0];
  const numAttrs = ATTR_LIST.length;
  return Math.sqrt(Math.max(0, val / numAttrs));
}

/**
 * Computes Mahalanobis / Euclidean distance context (covariance matrix & weights)
 * ONCE across all tracked destinations.
 */
async function computeMahalanobisContext(destinationsOrInterests, optionalInterests) {
  await getStats();
  let destinations;
  let interests;

  if (Array.isArray(destinationsOrInterests)) {
    destinations = destinationsOrInterests;
    interests = optionalInterests;
  } else {
    destinations = loadDestinations().filter((d) => d.trackingTier === 'tracked');
    interests = destinationsOrInterests;
  }

  const weights = computeWeights(interests);
  const useMahalanobis = shouldUseMahalanobis(destinations);

  let invCov = null;
  if (useMahalanobis) {
    try {
      const cov = await computeCovarianceMatrix(destinations);
      invCov = invertMatrix(cov);
    } catch (err) {
      console.warn(`Mahalanobis calculation failed (${err.message}), falling back to weighted Euclidean.`);
    }
  }

  return {
    weights,
    useMahalanobis: useMahalanobis && invCov !== null,
    invCov
  };
}

/**
 * Calculates distance using precomputed context.
 */
async function calculateDistanceWithContext(destA, destB, context) {
  const zA = await zScore(destA);
  const zB = await zScore(destB);

  if (context && context.useMahalanobis && context.invCov) {
    return mahalanobis(zA, zB, context.invCov);
  }

  return weightedEuclidean(zA, zB, context ? context.weights : computeWeights());
}

/**
 * Backward-compatibility wrapper for calculateDistance.
 */
async function calculateDistance(destA, destB, interests) {
  const context = await computeMahalanobisContext(interests);
  return calculateDistanceWithContext(destA, destB, context);
}

export {
  computeWeights,
  weightedEuclidean,
  computeCorrelationMatrix,
  shouldUseMahalanobis,
  computeCovarianceMatrix,
  invertMatrix,
  mahalanobis,
  computeMahalanobisContext,
  calculateDistanceWithContext,
  calculateDistance,
  matrixMultiply,
  arrayToMatrix,
  matrixTranspose,
  determinant
};
