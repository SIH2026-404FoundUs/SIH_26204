import { Loader2 } from 'lucide-react'

// Deliberately equal-weight primary/relief/outline variants -- the UI/UX
// doc's central integrity rule (§4.2.4) is that "accept" and "decline" get
// identical size and prominence, so no variant here is styled to look more
// or less important than another; the caller picks the one with the right
// *meaning*, not the loudest one.
const VARIANTS = {
  primary: 'bg-ink text-paper hover:bg-ink-soft focus-visible:ring-ink/20',
  relief: 'bg-relief text-paper hover:brightness-110 focus-visible:ring-relief/30',
  outline: 'border border-ink/25 bg-transparent text-ink hover:bg-ink/5 focus-visible:ring-ink/15',
  secondary: 'border border-paper-dim bg-paper text-ink hover:bg-paper-dim focus-visible:ring-ink/15',
  danger: 'bg-pressure text-paper hover:brightness-110 focus-visible:ring-pressure/30',
  ghost: 'text-ink/70 hover:bg-ink/5 focus-visible:ring-ink/15',
}

const SIZES = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'py-3 px-6 text-sm',
}

// The one button used everywhere. Six variants, three sizes -- that's the
// full vocabulary; don't reach for one-off button styling in a page.
export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  icon: Icon,
  children,
  className = '',
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition focus:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${SIZES[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {loading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : Icon ? <Icon size={16} aria-hidden="true" /> : null}
      {children}
    </button>
  )
}
