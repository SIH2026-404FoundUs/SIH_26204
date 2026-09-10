// 0 -> relief teal, 1 -> pressure ochre (linear interpolation). Shared so the
// heatmap cell, PressureBadge, and every detail panel agree on the colour for
// a score -- pressure ochre and relief teal are the only two colours the
// design system uses to mean "crowding" (UI/UX doc §3.1), so this is the one
// place they are ever mixed.
const RELIEF = [46, 107, 94] // #2E6B5E
const PRESSURE = [201, 122, 62] // #C97A3E
const NEUTRAL = '#6B7280' // --ash, used only when the score itself is unknown

export const scoreColor = (score) => {
  if (score == null) return NEUTRAL
  const t = Math.max(0, Math.min(1, score))
  const [r, g, b] = RELIEF.map((c0, i) => Math.round(c0 + (PRESSURE[i] - c0) * t))
  return `rgb(${r}, ${g}, ${b})`
}

// Plain-English state word -- colour is never the only signal (§9).
export const scoreLabel = (score) => {
  if (score == null) return 'unknown'
  if (score >= 0.6) return 'crowded'
  if (score >= 0.35) return 'moderate'
  return 'calm'
}

// Keep every compact pressure readout on the same 0..100 scale.
export const scorePercent = (score) => (
  score == null ? null : Math.round(Math.max(0, Math.min(1, Number(score))) * 100)
)
