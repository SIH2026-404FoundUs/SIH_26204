// Status pill with a fixed semantic palette, remapped onto the design
// tokens: success/positive reads as relief teal, danger/warning as pressure
// ochre -- but only ever tinted, never the saturated crowding colours
// themselves, since those are reserved exclusively for actual pressure data
// (§3.1's "never used as decorative accents elsewhere" rule).
const TONES = {
  neutral: 'bg-paper-dim text-ink/70',
  success: 'bg-relief/10 text-relief',
  warning: 'bg-pressure/10 text-pressure',
  danger: 'bg-pressure/15 text-pressure',
  info: 'bg-ink/8 text-ink-soft',
}

export default function Badge({ tone = 'neutral', icon: Icon, children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]} ${className}`}>
      {Icon && <Icon size={12} aria-hidden="true" />}
      {children}
    </span>
  )
}
