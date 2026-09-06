import { AlertTriangle, Clock, MinusCircle } from 'lucide-react'
import { scoreColor } from './scoreColor'

const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`)

const COMPONENT_LABELS = {
  access: 'Access demand',
  stay: 'Stay scarcity',
  calendar: 'Calendar',
  weather: 'Weather pull',
  capacity: 'Capacity prior',
}

// Honest, per-component breakdown of one destination_pressure row (spec §6).
// Shows the date-varying/static split and every drop/degrade flag — the UI is
// required to surface these (spec §4, §5).
export default function PressureCard({ row }) {
  if (!row) return null
  const { components = {}, dropped = [], degraded = [], lowConfidence, stale } = row

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="font-semibold text-slate-900">{row.destId}</h3>
        <span className="text-sm text-slate-500">{row.date}</span>
      </div>

      <div className="mt-1 flex items-center gap-2">
        <span className="text-3xl font-bold" style={{ color: scoreColor(row.score) }}>
          {row.score == null ? 'no score' : row.score.toFixed(2)}
        </span>
        <span className="text-xs text-slate-500">
          {pct(row.dateVaryingSubtotal)} date-varying · {pct(row.staticSubtotal)} static
        </span>
      </div>

      {(lowConfidence || stale || degraded.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
          {lowConfidence && (
            <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-amber-800">
              <AlertTriangle size={12} /> low confidence
            </span>
          )}
          {degraded.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded bg-orange-100 px-2 py-0.5 text-orange-800">
              <MinusCircle size={12} /> road degraded — access is static
            </span>
          )}
          {stale && (
            <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-slate-600">
              <Clock size={12} /> stale
            </span>
          )}
        </div>
      )}

      <dl className="mt-3 space-y-1.5">
        {Object.keys(COMPONENT_LABELS).map((key) => {
          const c = components[key]
          const isDropped = dropped.includes(key)
          return (
            <div key={key} className="flex items-center justify-between text-sm">
              <dt className="text-slate-600">{COMPONENT_LABELS[key]}</dt>
              <dd className="tabular-nums">
                {isDropped ? (
                  <span className="text-rose-600">dropped</span>
                ) : c ? (
                  <>
                    <span className="font-medium text-slate-900">{pct(c.value)}</span>
                    <span className="ml-2 text-xs text-slate-400">w {c.weight}</span>
                  </>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </dd>
            </div>
          )
        })}
      </dl>

      {components.access && (components.access.rail != null || components.access.road != null) && (
        <p className="mt-2 text-xs text-slate-400">
          access = {components.access.c}·rail({pct(components.access.rail)}) +{' '}
          {(1 - components.access.c).toFixed(2)}·road({pct(components.access.road)})
        </p>
      )}
    </div>
  )
}
