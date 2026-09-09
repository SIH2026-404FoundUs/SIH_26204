import { useMemo, useState } from 'react'
import { MapPin } from 'lucide-react'
import GoogleIndiaMap from '../pressure/GoogleIndiaMap'
import PressureBadge from '../pressure/PressureBadge'
import Card from '../ui/Card'
import LoadingState from '../ui/LoadingState'
import EmptyState from '../ui/EmptyState'
import Alert from '../ui/Alert'
import { inputClass } from '../ui/FormField'
import { getDestinationLabel } from '../../lib/destinations'

// Section 1 -- Destination Pressure Heatmap (dashboard spec §Section 1). The
// map itself is the exact same live-map primitive the traveller-facing
// Explore page uses (GoogleIndiaMap, reused verbatim, not reimplemented) --
// what's different here is the data feeding it: these rows come from the
// authority-gated GET /api/v1/dashboard/pressure, not the public map
// endpoint, and a destination picker sits alongside it so "select a
// destination, see its name/score/tier" (spec) doesn't require touching
// GoogleIndiaMap's own click-to-navigate behaviour, which the traveller
// Explore page also depends on.
export default function PressureSection({ data, isLoading, error, date }) {
  const destinations = data?.destinations
  const [selectedId, setSelectedId] = useState('')

  const rows = useMemo(() => destinations ?? [], [destinations])
  const sorted = useMemo(
    () => [...rows].sort((a, b) => (b.score ?? -1) - (a.score ?? -1)),
    [rows]
  )
  const selected = rows.find((r) => r.destId === selectedId) ?? sorted[0] ?? null

  return (
    <Card className="mb-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">Destination pressure heatmap</h2>
        <span className="font-mono text-xs text-ash">{date}</span>
      </div>

      {error && <div className="mb-4"><Alert tone="error">{error}</Alert></div>}

      {isLoading ? (
        <LoadingState label="Reading the pressure map…" />
      ) : !error && rows.length === 0 ? (
        <EmptyState icon={MapPin} title="No data available for this date" description="No destination has a computed pressure row for this date yet." />
      ) : !error ? (
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <GoogleIndiaMap rows={rows} />

          <div>
            <label htmlFor="dash-dest-picker" className="mb-2 block text-xs font-medium text-ink/80">
              Select a destination
            </label>
            <select
              id="dash-dest-picker"
              className={inputClass}
              value={selected?.destId ?? ''}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {sorted.map((r) => (
                <option key={r.destId} value={r.destId}>
                  {getDestinationLabel(r.destId)}
                </option>
              ))}
            </select>

            {selected && (
              <div className="mt-4 rounded-lg border border-paper-dim bg-white p-4">
                <p className="text-sm font-semibold text-ink">{getDestinationLabel(selected.destId)}</p>
                <div className="mt-2">
                  <PressureBadge score={selected.score} size="lg" />
                </div>
                {selected.stale && (
                  <p className="mt-2 text-xs text-pressure">Stale -- last computed more than 24h ago.</p>
                )}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </Card>
  )
}
