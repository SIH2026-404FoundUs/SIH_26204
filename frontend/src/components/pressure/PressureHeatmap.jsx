import { useEffect, useState } from 'react'
import { Activity } from 'lucide-react'
import { usePressureStore } from '../../store/usePressureStore'
import PressureCard from './PressureCard'
import { scoreColor } from './scoreColor'
import { getDestinationLabel } from '../../lib/destinations'
import PageHeader from '../ui/PageHeader'
import LoadingState from '../ui/LoadingState'
import EmptyState from '../ui/EmptyState'
import Alert from '../ui/Alert'
import { inputClass } from '../ui/FormField'

// Tracked-destination crowding grid for a chosen date (spec §10 /pressure/map).
export default function PressureHeatmap() {
  const { date, rows, isLoadingMap, error, setDate, fetchMap } = usePressureStore()
  const [openId, setOpenId] = useState(null)

  useEffect(() => {
    fetchMap()
  }, [fetchMap])

  const sorted = [...rows].sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
  const openRow = rows.find((r) => r.destId === openId)

  return (
    <div>
      <PageHeader icon={Activity} title="Crowding levels" description="How busy each tracked destination is expected to be on a given date, and why." />

      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm font-medium text-slate-700" htmlFor="pressure-date">Date</label>
        <input id="pressure-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${inputClass} w-auto`} />
      </div>

      {error && <div className="mb-4"><Alert tone="error">{error}</Alert></div>}

      {isLoadingMap ? (
        <LoadingState label="Loading crowding data…" />
      ) : rows.length === 0 && !error ? (
        <EmptyState title="No data for this date" description="Try a different date, or check back later -- this destination may not have been checked yet." />
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {sorted.map((row) => (
            <button
              key={row.destId}
              type="button"
              onClick={() => setOpenId(openId === row.destId ? null : row.destId)}
              className={`rounded-xl border p-3 text-left transition hover:shadow-sm ${openId === row.destId ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-slate-800">{getDestinationLabel(row.destId)}</span>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: scoreColor(row.score) }} />
              </div>
              <div className="mt-1 text-2xl font-bold tabular-nums" style={{ color: scoreColor(row.score) }}>
                {row.score == null ? 'Unknown' : `${Math.round(row.score * 100)}%`}
              </div>
              {(row.lowConfidence || row.degraded?.length > 0 || row.stale) && (
                <div className="mt-0.5 flex flex-wrap gap-1 text-[10px] text-slate-400">
                  {row.lowConfidence && <span className="text-amber-600">Uncertain</span>}
                  {row.degraded?.length > 0 && <span className="text-orange-600">Partial data</span>}
                  {row.stale && <span>Updating…</span>}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {openRow && <div className="mt-4"><PressureCard row={openRow} /></div>}
    </div>
  )
}
