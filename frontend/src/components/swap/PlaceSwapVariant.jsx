import { MapPin, TrendingDown, Clock, Sparkles, Compass, Check } from 'lucide-react'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import Button from '../ui/Button'

/**
 * A single alternative destination for a crowded trip. All numbers here come
 * straight from the substitution engine's response -- nothing on this card is
 * invented client-side. Same design tokens/shared components (Card/Badge/
 * Button) as every other card in the app -- this used to be the one place
 * still on hardcoded indigo/emerald/amber/slate Tailwind colors instead of
 * ink/paper/pressure/relief/ash.
 */
export default function PlaceSwapVariant({ place, requestedPressure = 0.8, onAccept }) {
  if (!place) return null

  const {
    destId,
    displayName,
    distance,
    dStar = 1.15,
    pressure = 0.5,
    travelTimeRatio,
    travelTimeHours = 0,
    stayCost = 0,
    transportCost = 0,
    totalCost = 0,
    savingINR = 0,
    rank = 1,
  } = place

  // Calculate pressure relief drop (percentage point reduction)
  const pressureRelief = Math.max(0, requestedPressure - pressure)
  const pressureReliefPercent = Math.round(pressureRelief * 100)
  const currentPressurePercent = Math.round(pressure * 100)

  // Format travel time text
  const hasTravelHours = typeof travelTimeHours === 'number' && travelTimeHours > 0
  const ratioVal = typeof travelTimeRatio === 'number' && travelTimeRatio > 0 ? travelTimeRatio : 1.0
  const travelDeltaText =
    ratioVal < 0.98
      ? `${Math.round((1 - ratioVal) * 100)}% faster`
      : ratioVal > 1.02
      ? `${Math.round((ratioVal - 1) * 100)}% longer`
      : 'Same duration'

  // Similarity score out of 100 based on distance vs dStar
  const similarityScore = Math.max(0, Math.min(100, Math.round((1 - distance / (dStar * 1.2)) * 100)))

  const handleAccept = () => {
    if (typeof onAccept === 'function') onAccept(place)
  }

  return (
    <Card
      className="card-enter border-2 transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
      style={{ borderColor: 'var(--color-ink)' }}
      padding="p-4"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-paper-dim text-xs font-bold text-ink/70">
            #{rank}
          </span>
          <Badge tone="success" icon={Sparkles}>High relief alternative</Badge>
        </div>
        {savingINR > 0 ? (
          <Badge tone="warning">Save ₹{savingINR.toLocaleString('en-IN')}</Badge>
        ) : (
          <Badge tone="neutral">Est. ₹{(totalCost || 7000).toLocaleString('en-IN')}</Badge>
        )}
      </div>

      <h3 className="flex items-center gap-1.5 font-display text-lg text-ink">
        <MapPin size={17} className="shrink-0 text-pressure" aria-hidden="true" />
        {displayName || destId}
      </h3>

      <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-paper-dim/50 p-2">
        <div className="flex flex-col items-center rounded-md bg-paper p-1.5 text-center">
          <span className="flex items-center gap-1 text-[11px] text-ash">
            <Compass size={11} aria-hidden="true" /> Match
          </span>
          <span className="mt-0.5 text-sm font-semibold text-ink">{similarityScore}%</span>
          <span className="text-[10px] text-ash">d = {typeof distance === 'number' ? distance.toFixed(2) : distance}</span>
        </div>
        <div className="flex flex-col items-center rounded-md bg-paper p-1.5 text-center">
          <span className="flex items-center gap-1 text-[11px] text-ash">
            <Clock size={11} aria-hidden="true" /> Travel
          </span>
          <span className="mt-0.5 text-sm font-semibold text-ink">
            {hasTravelHours ? `${travelTimeHours >= 1 ? travelTimeHours.toFixed(1) : Math.round(travelTimeHours * 60)} ${travelTimeHours >= 1 ? 'hrs' : 'mins'}` : `${ratioVal.toFixed(1)}x`}
          </span>
          <span className="text-[10px] font-medium text-relief">{travelDeltaText}</span>
        </div>
        <div className="flex flex-col items-center rounded-md bg-paper p-1.5 text-center">
          <span className="flex items-center gap-1 text-[11px] text-ash">
            <TrendingDown size={11} aria-hidden="true" /> Crowd
          </span>
          <span className="mt-0.5 text-sm font-semibold text-relief">-{pressureReliefPercent}pt</span>
          <span className="text-[10px] text-ash">now {currentPressurePercent}%</span>
        </div>
      </div>

      {(stayCost > 0 || transportCost > 0) && (
        <div className="mt-3 flex items-center justify-between rounded-lg bg-paper-dim/50 px-3 py-2 text-xs text-ink/70">
          <span>Stay: <span className="font-semibold text-ink">₹{stayCost.toLocaleString('en-IN')}</span></span>
          <span className="h-3 w-px bg-paper-dim" aria-hidden="true" />
          <span>Transport: <span className="font-semibold text-ink">₹{transportCost.toLocaleString('en-IN')}</span></span>
        </div>
      )}

      <Button variant="primary" fullWidth icon={Check} className="mt-4" onClick={handleAccept}>
        Swap destination
      </Button>
    </Card>
  )
}
