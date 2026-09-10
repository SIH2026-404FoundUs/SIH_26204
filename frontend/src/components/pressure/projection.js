// Maps a destination's real lat/lng onto the 0-1000 coordinate space of
// public/india-map.svg (a real state-boundary outline, simplemaps.com,
// recolored to match the design tokens). Calibrated via least-squares fit
// against that SVG's own per-state label-anchor points (<circle cx cy>) for
// eight states spanning the country -- not an arbitrary guess. Residuals
// against those anchors are all under ~15 units on a 1000-unit canvas
// (under 2%), and well under that for Himachal Pradesh and Telangana
// specifically, which is what matters since every seeded destination is in
// one of those two states.
const A = 27.388617511169993; // x = A*lng + B*lat + C
const B = 0.10122460444355763;
const C = -1772.288631604592;
const D = 0.535553869106316; // y = D*lng + E*lat + F
const E = -29.612850742566355;
const F = 1123.3563843893837;

// Returns {leftPct, topPct} for absolute-positioning a marker over the map
// image (which shares the same 0-1000 viewBox), or null if lat/lng missing.
export function projectToMap(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null
  const x = A * lng + B * lat + C
  const y = D * lng + E * lat + F
  return { leftPct: (x / 1000) * 100, topPct: (y / 1000) * 100 }
}
