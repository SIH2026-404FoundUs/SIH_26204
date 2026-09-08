import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Activity } from 'lucide-react'
import { usePressureStore } from '../../store/usePressureStore'
import PressureRing from './PressureRing'
import PressureBadge from './PressureBadge'
import { getDestinationLabel } from '../../lib/destinations'
import PageHeader from '../ui/PageHeader'
import LoadingState from '../ui/LoadingState'
import EmptyState from '../ui/EmptyState'
import Alert from '../ui/Alert'
import { inputClass } from '../ui/FormField'

// Explore -- Pressure Map (frontend sitemap doc, Page 7). The IsobarMap
// metaphor generalised to every tracked destination at once (UI/UX doc
// §7.1): each destination renders as a breathing ring, sized/coloured by its
// current score, on the dark isobar canvas -- no login, no specific trip
// request required. Each ring links through to its Destination Detail page.
export default function PressureHeatmap() {
  const { date, rows, isLoadingMap, error, setDate, fetchMap } = usePressureStore()

  useEffect(() => {
    fetchMap()
  }, [fetchMap])

  const sorted = [...rows].sort((a, b) => (b.score ?? -1) - (a.score ?? -1))

  return (
    <div>
      <PageHeader icon={Activity} title="Explore — pressure map" description="How busy every tracked destination is expected to be on a given date. No trip request needed -- pick a date and look." />

      <div className="mb-5 flex items-center gap-3">
        <label className="text-sm font-medium text-ink/80" htmlFor="pressure-date">Date</label>
        <input id="pressure-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${inputClass} w-auto`} />
      </div>

      {error && <div className="mb-4"><Alert tone="error">{error}</Alert></div>}

      {isLoadingMap ? (
        <LoadingState label="Reading the pressure map…" />
      ) : rows.length === 0 && !error ? (
        <EmptyState title="No data for this date" description="Try a different date, or check back later -- this destination may not have been checked yet." />
      ) : (
        <div className="isobar-canvas rounded-lg p-4 sm:p-6">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {sorted.map((row) => (
              <Link
                key={row.destId}
                to={`/explore/${row.destId}`}
                className="glass-surface-dark flex flex-col items-center gap-1 rounded-lg p-3 text-center transition hover:scale-[1.02]"
              >
                <PressureRing score={row.score} variant={row.score >= 0.6 ? 'requested' : 'alternative'} size={64} />
                <span className="mt-1 truncate text-sm font-medium text-paper">{getDestinationLabel(row.destId)}</span>
                <PressureBadge score={row.score} size="sm" />
                {(row.lowConfidence || row.degraded?.length > 0 || row.stale) && (
                  <div className="flex flex-wrap justify-center gap-1 text-[10px] text-paper/50">
                    {row.lowConfidence && <span>Uncertain</span>}
                    {row.degraded?.length > 0 && <span>Partial data</span>}
                    {row.stale && <span>Updating…</span>}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
