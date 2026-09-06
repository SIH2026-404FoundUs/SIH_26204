import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { usePressureStore } from '../../store/usePressureStore'
import PressureCard from './PressureCard'
import { scoreColor } from './scoreColor'

// Tracked-destination pressure grid for a chosen date (spec §10 /pressure/map).
// Per the work-split the demo-polish heatmap is Madhuri's — this is the working
// reference wired to the real endpoint; she can restyle or replace it.
export default function PressureHeatmap() {
  const { date, rows, isLoadingMap, error, setDate, fetchMap } = usePressureStore()
  const [openId, setOpenId] = useState(null)

  useEffect(() => {
    fetchMap()
  }, [fetchMap])

  const sorted = [...rows].sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
  const openRow = rows.find((r) => r.destId === openId)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-slate-700">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-indigo-500"
        />
        {isLoadingMap && <Loader2 size={16} className="animate-spin text-indigo-600" />}
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      )}

      {!isLoadingMap && rows.length === 0 && !error && (
        <p className="text-sm text-slate-500">
          No pressure rows for {date}. Run the precompute job, or the destination
          gets computed live on first request.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {sorted.map((row) => (
          <button
            key={row.destId}
            type="button"
            onClick={() => setOpenId(openId === row.destId ? null : row.destId)}
            className={`rounded-lg border p-3 text-left transition hover:shadow-sm ${
              openId === row.destId ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="truncate text-sm font-medium text-slate-800">{row.destId}</span>
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: scoreColor(row.score) }}
              />
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums" style={{ color: scoreColor(row.score) }}>
              {row.score == null ? '—' : row.score.toFixed(2)}
            </div>
            <div className="mt-0.5 flex flex-wrap gap-1 text-[10px] text-slate-400">
              {row.lowConfidence && <span className="text-amber-600">low-conf</span>}
              {row.degraded?.length > 0 && <span className="text-orange-600">road-degraded</span>}
              {row.stale && <span>stale</span>}
            </div>
          </button>
        ))}
      </div>

      {openRow && <PressureCard row={openRow} />}
    </div>
  )
}
