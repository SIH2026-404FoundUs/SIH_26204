import { Calendar, TrendingDown, IndianRupee, Check } from 'lucide-react'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import { formatDate } from '../../lib/time'

/** A less-crowded date for the same destination. Same card shape/metrics
 * grid as PlaceSwapVariant so the two alternative types read as one family,
 * not two different UIs bolted together. */
export default function DateSwapVariant({ dateObj, requestedPressure = 0.8, onAccept }) {
  if (!dateObj) return null
  const { startDate, pressure = 0.4, savingINR = 0 } = dateObj

  const pressureReliefPercent = Math.round(Math.max(0, requestedPressure - pressure) * 100)
  const candidatePressurePercent = Math.round(pressure * 100)
  const formattedDate = formatDate(startDate)

  return (
    <Card
      className="card-enter border-2 transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
      style={{ borderColor: 'var(--color-ink)' }}
      padding="p-4"
    >
      <div className="mb-3">
        <Badge tone="success">Optimal low-crowd window</Badge>
      </div>

      <h3 className="flex items-center gap-1.5 font-display text-lg text-ink">
        <Calendar size={17} className="shrink-0 text-relief" aria-hidden="true" />
        {formattedDate}
      </h3>
      <p className="mt-0.5 text-xs text-ash">Same destination, shifted travel dates</p>

      <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-paper-dim/50 p-2">
        <div className="flex flex-col items-center rounded-md bg-paper p-1.5 text-center">
          <span className="flex items-center gap-1 text-[11px] text-ash">
            <TrendingDown size={11} aria-hidden="true" /> Pressure relief
          </span>
          <span className="mt-0.5 text-sm font-semibold text-relief">-{pressureReliefPercent}pt</span>
          <span className="text-[10px] text-ash">score {candidatePressurePercent}%</span>
        </div>
        <div className="flex flex-col items-center rounded-md bg-paper p-1.5 text-center">
          <span className="flex items-center gap-1 text-[11px] text-ash">
            <IndianRupee size={11} aria-hidden="true" /> Trip savings
          </span>
          <span className="mt-0.5 text-sm font-semibold text-ink">₹{savingINR.toLocaleString('en-IN')}</span>
          <span className="text-[10px] text-ash">{savingINR > 0 ? 'lower rates' : 'same rates'}</span>
        </div>
      </div>

      <Button variant="relief" fullWidth icon={Check} className="mt-4" onClick={() => onAccept?.(dateObj)}>
        Shift trip dates
      </Button>
    </Card>
  )
}
