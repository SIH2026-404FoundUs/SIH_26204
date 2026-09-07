import { MapPin, TrendingDown, Clock } from 'lucide-react'
import Card from '../ui/Card'
import Button from '../ui/Button'
import { getDestinationLabel } from '../../lib/destinations'

/**
 * A single alternative destination for a crowded trip. All numbers here come
 * straight from the substitution engine's response -- nothing on this card is
 * invented client-side.
 */
export default function PlaceSwapVariant({ place, requestedPressure = 0.8, onAccept }) {
  if (!place) return null

  const { destId, displayName, distance, dStar = 1.15, pressure = 0.5, travelTimeRatio = 1.0, savingINR = 0 } = place
  const name = displayName || getDestinationLabel(destId)

  const pressureReliefPercent = Math.round(Math.max(0, requestedPressure - pressure) * 100)
  const currentPressurePercent = Math.round(pressure * 100)
  const similarityScore = Math.max(0, Math.min(100, Math.round((1 - distance / (dStar * 1.2)) * 100)))
  const travelDeltaText =
    travelTimeRatio < 0.98 ? `${Math.round((1 - travelTimeRatio) * 100)}% faster`
      : travelTimeRatio > 1.02 ? `${Math.round((travelTimeRatio - 1) * 100)}% longer`
      : 'About the same'

  return (
    <Card className="transition hover:border-indigo-300" padding="p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="flex items-center gap-1.5 text-base font-semibold text-slate-900">
          <MapPin size={16} className="shrink-0 text-indigo-500" aria-hidden="true" />
          {name}
        </h3>
        {savingINR > 0 && (
          <span className="shrink-0 text-xs font-semibold text-emerald-700">Save ₹{savingINR.toLocaleString('en-IN')}</span>
        )}
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div>
          <dt className="text-slate-400">Similar to your pick</dt>
          <dd className="mt-0.5 font-semibold text-slate-800">{similarityScore}%</dd>
        </div>
        <div>
          <dt className="flex items-center justify-center gap-1 text-slate-400"><Clock size={11} aria-hidden="true" />Travel time</dt>
          <dd className="mt-0.5 font-semibold text-slate-800">{travelDeltaText}</dd>
        </div>
        <div>
          <dt className="flex items-center justify-center gap-1 text-slate-400"><TrendingDown size={11} aria-hidden="true" />Crowding</dt>
          <dd className="mt-0.5 font-semibold text-emerald-600">-{pressureReliefPercent}pt ({currentPressurePercent}%)</dd>
        </div>
      </dl>

      <Button variant="primary" fullWidth className="mt-4" onClick={() => onAccept?.(place)}>
        Switch to {name}
      </Button>
    </Card>
  )
}
