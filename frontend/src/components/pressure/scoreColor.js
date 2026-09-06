// 0 -> green, 1 -> red (smooth). Shared so the heatmap cell and the detail
// panel agree on the colour for a score.
export const scoreColor = (score) =>
  score == null ? '#94a3b8' : `hsl(${(1 - score) * 120}, 65%, 42%)`
