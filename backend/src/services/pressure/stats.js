// Small stats helpers for the pressure engine. Hand-rolled — no stats dependency
// for two ~10-line functions.

// Least-squares fit of y over evenly-spaced x = 0..n-1. Spec §8 calls this as
// `linearRegression(scores).slope`.
export function linearRegression(ys) {
  const n = ys.length;
  if (n < 2) return { slope: 0 };
  const xMean = (n - 1) / 2;
  const yMean = ys.reduce((s, y) => s + y, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (ys[i] - yMean);
    den += (i - xMean) ** 2;
  }
  return { slope: den === 0 ? 0 : num / den };
}

// Spearman rank correlation between two equal-length arrays (spec §9 metric).
// Ties get averaged ranks.
export function spearman(a, b) {
  if (a.length !== b.length || a.length < 2) return null;
  const rank = (arr) => {
    const order = arr
      .map((v, i) => [v, i])
      .sort((x, y) => x[0] - y[0]);
    const ranks = new Array(arr.length);
    let i = 0;
    while (i < order.length) {
      let j = i;
      while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++;
      const avg = (i + j) / 2 + 1; // 1-based, averaged over the tie group
      for (let k = i; k <= j; k++) ranks[order[k][1]] = avg;
      i = j + 1;
    }
    return ranks;
  };
  const ra = rank(a);
  const rb = rank(b);
  const n = a.length;
  const d2 = ra.reduce((s, r, i) => s + (r - rb[i]) ** 2, 0);
  return 1 - (6 * d2) / (n * (n * n - 1));
}
