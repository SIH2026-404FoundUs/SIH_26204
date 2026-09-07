// One card shape used everywhere: border-slate-200, rounded-2xl, shadow-sm.
// No nested "dark hero banner inside a white card" patterns, no per-page
// custom radii/shadows.
export default function Card({ children, className = '', padding = 'p-5' }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white ${padding} ${className}`}>
      {children}
    </div>
  )
}
