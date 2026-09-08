import { scoreColor, scoreLabel } from './scoreColor'

// Single source of truth for how a pressure score is ever displayed (UI/UX
// doc §5): a mono number, "/100", and a plain-English state word. Changing
// the colour threshold or the wording happens in exactly one place.
export default function PressureBadge({ score, size = 'md' }) {
  const color = scoreColor(score)
  const label = scoreLabel(score)
  const pct = score == null ? null : Math.round(score * 100)

  const numSize = size === 'lg' ? 'text-4xl' : size === 'sm' ? 'text-base' : 'text-xl'

  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className={`font-mono font-semibold tabular-nums ${numSize}`} style={{ color }}>
        {pct == null ? '—' : pct}
      </span>
      <span className="text-xs text-ash">/ 100 &middot; {label}</span>
    </span>
  )
}
