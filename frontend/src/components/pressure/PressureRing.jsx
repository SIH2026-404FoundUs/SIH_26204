import { scoreColor } from './scoreColor'

/**
 * The isobar ring: a destination rendered as a breathing weather system
 * (UI/UX doc §4.2.1). The requested/high-pressure destination gets two
 * concentric rings in pressure ochre on a 3.2s cycle; an alternative gets one
 * smaller, slower ring in relief teal on a 5.5s cycle -- calmer by animation
 * speed alone, before anyone reads a number. Purely presentational: takes a
 * score and a variant, fetches nothing.
 */
export default function PressureRing({ score, variant = 'requested', size = 96 }) {
  const color = scoreColor(score)
  const isRequested = variant === 'requested'
  const animClass = isRequested ? 'pressure-ring-hot' : 'pressure-ring-calm'
  const cx = size / 2
  const cy = size / 2

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
      {isRequested && (
        <circle
          cx={cx} cy={cy} r={size * 0.42}
          fill="none" stroke={color} strokeWidth={1.5} opacity={0.5}
          className={animClass}
          style={{ transformOrigin: `${cx}px ${cy}px`, animationDelay: '0.4s' }}
        />
      )}
      <circle
        cx={cx} cy={cy} r={size * (isRequested ? 0.3 : 0.26)}
        fill={color} fillOpacity={0.18} stroke={color} strokeWidth={2}
        className={animClass}
        style={{ transformOrigin: `${cx}px ${cy}px` }}
      />
      <circle cx={cx} cy={cy} r={size * 0.06} fill={color} />
    </svg>
  )
}
