// One card shape used everywhere: hairline paper-dim border, paper surface,
// minimal radius -- per the doc's "roundedness is spent deliberately, not
// applied uniformly" rule (§3.3). Pass interactive to get the hover lift used
// for clickable rows (alternative cards, list rows).
export default function Card({ children, className = '', padding = 'p-5', interactive = false }) {
  return (
    <div
      className={`rounded-lg border border-paper-dim bg-paper ${padding} ${interactive ? 'transition hover:border-ink/25 hover:shadow-sm' : ''} ${className}`}
    >
      {children}
    </div>
  )
}
