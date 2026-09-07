import { TriangleAlert, Clock, MinusCircle } from 'lucide-react'
import { scoreColor } from './scoreColor'
import { getDestinationLabel } from '../../lib/destinations'
import Card from '../ui/Card'
import Badge from '../ui/Badge'

const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`)

const COMPONENT_LABELS = {
  access: 'Getting there (trains & roads)',
  stay: 'Room availability',
  calendar: 'Holidays & weekends',
  weather: 'Weather',
  capacity: 'Typical demand',
}

// Per-signal breakdown of one crowding reading -- this detail is the point of
// the feature (an honest "why this number"), not implementation leakage.
export default function PressureCard({ row }) {
  if (!row) return null
  const { components = {}, dropped = [], degraded = [], lowConfidence, stale } = row

  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <h3 className="font-semibold text-slate-900">{getDestinationLabel(row.destId)}</h3>
        <span className="text-sm text-slate-500">{row.date}</span>
      </div>

      <div className="mt-1 flex items-center gap-2">
        <span className="text-3xl font-bold" style={{ color: scoreColor(row.score) }}>
          {row.score == null ? 'Unknown' : `${Math.round(row.score * 100)}%`}
        </span>
        <span className="text-xs text-slate-500">estimated crowding</span>
      </div>

      {(lowConfidence || stale || degraded.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {lowConfidence && <Badge tone="warning" icon={TriangleAlert}>Based on limited data</Badge>}
          {degraded.length > 0 && <Badge tone="warning" icon={MinusCircle}>Some signals unavailable</Badge>}
          {stale && <Badge tone="neutral" icon={Clock}>Updating…</Badge>}
        </div>
      )}

      <dl className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
        {Object.keys(COMPONENT_LABELS).map((key) => {
          const c = components[key]
          const isDropped = dropped.includes(key)
          return (
            <div key={key} className="flex items-center justify-between text-sm">
              <dt className="text-slate-600">{COMPONENT_LABELS[key]}</dt>
              <dd className="tabular-nums">
                {isDropped ? (
                  <span className="text-slate-400">No data</span>
                ) : c ? (
                  <span className="font-medium text-slate-900">{pct(c.value)}</span>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </dd>
            </div>
          )
        })}
      </dl>
    </Card>
  )
}
