// One card shape used everywhere: hairline paper-dim border, paper surface,
// minimal radius -- per the doc's "roundedness is spent deliberately, not
// applied uniformly" rule (§3.3). Pass interactive to get the hover lift used
// for clickable rows (alternative cards, list rows). Any other prop (style,
// onClick, data-*, ...) passes straight through to the underlying div --
// needed e.g. to override border-color via inline style, since a plain
// className string can't reliably beat border-paper-dim's own generated
// Tailwind rule on specificity/order alone.
export default function Card({ children, className = '', padding = 'p-5', interactive = false, ...props }) {
  return (
    <div
      className={`rounded-lg border border-paper-dim bg-paper ${padding} ${interactive ? 'transition hover:border-ink/25 hover:shadow-sm' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
