import { TriangleAlert, Clock, MinusCircle } from 'lucide-react'
import PressureBadge from './PressureBadge'
import { getDestinationLabel } from '../../lib/destinations'
import Card from '../ui/Card'
import Badge from '../ui/Badge'

const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`)

const COMPONENT_LABELS = {
  demand: 'Demand (ML)',
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
        <h3 className="font-display text-lg text-ink">{getDestinationLabel(row.destId)}</h3>
        <span className="font-mono text-sm text-ash">{row.date}</span>
      </div>

      <div className="mt-1">
        <PressureBadge score={row.score} size="lg" />
      </div>

      {(lowConfidence || stale || degraded.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {lowConfidence && <Badge tone="warning" icon={TriangleAlert}>Based on limited data</Badge>}
          {degraded.length > 0 && <Badge tone="warning" icon={MinusCircle}>Some signals unavailable</Badge>}
          {stale && <Badge tone="neutral" icon={Clock}>Updating…</Badge>}
        </div>
      )}

      <dl className="mt-3 space-y-1.5 border-t border-paper-dim pt-3">
        {Object.keys(COMPONENT_LABELS).map((key) => {
          const c = components[key]
          const isDropped = dropped.includes(key)
          return (
            <div key={key} className="flex items-center justify-between text-sm">
              <dt className="text-ink/60">{COMPONENT_LABELS[key]}</dt>
              <dd className="font-mono tabular-nums">
                {isDropped ? (
                  <span className="text-ash">No data</span>
                ) : c ? (
                  <span className="font-medium text-ink">{pct(c.value)}</span>
                ) : (
                  <span className="text-ash">—</span>
                )}
              </dd>
            </div>
          )
        })}
      </dl>
    </Card>
  )
}
