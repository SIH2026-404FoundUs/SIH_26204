import { Calendar, TrendingDown } from 'lucide-react'
import Card from '../ui/Card'
import Button from '../ui/Button'

function formatDate(dateString) {
  if (!dateString) return ''
  const parsed = new Date(dateString)
  if (Number.isNaN(parsed.getTime())) return dateString
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** A less-crowded date for the same destination. */
export default function DateSwapVariant({ dateObj, requestedPressure = 0.8, onAccept }) {
  if (!dateObj) return null
  const { startDate, pressure = 0.4, savingINR = 0 } = dateObj

  const pressureReliefPercent = Math.round(Math.max(0, requestedPressure - pressure) * 100)
  const candidatePressurePercent = Math.round(pressure * 100)
  const formattedDate = formatDate(startDate)

  return (
    <Card className="transition hover:border-relief/40" padding="p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="flex items-center gap-1.5 text-base font-semibold text-ink">
          <Calendar size={16} className="shrink-0 text-relief" aria-hidden="true" />
          {formattedDate}
        </h3>
        {savingINR > 0 && (
          <span className="shrink-0 text-xs font-semibold text-relief">Save ₹{savingINR.toLocaleString('en-IN')}</span>
        )}
      </div>
      <p className="mt-0.5 text-xs text-ash">Same destination, different dates</p>

      <div className="mt-3 flex items-center gap-1.5 text-xs text-ash">
        <TrendingDown size={12} className="text-relief" aria-hidden="true" />
        <span className="font-medium text-relief">-{pressureReliefPercent}pt crowding</span>
        <span>({candidatePressurePercent}% vs your original date)</span>
      </div>

      <Button variant="secondary" fullWidth className="mt-4 hover:border-relief/40" onClick={() => onAccept?.(dateObj)}>
        Move trip to this date
      </Button>
    </Card>
  )
}
