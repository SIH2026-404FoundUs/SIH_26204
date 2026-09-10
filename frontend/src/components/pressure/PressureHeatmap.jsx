import { useEffect } from 'react'
import { Activity } from 'lucide-react'
import { usePressureStore } from '../../store/usePressureStore'
import GoogleIndiaMap from './GoogleIndiaMap'
import PageHeader from '../ui/PageHeader'
import LoadingState from '../ui/LoadingState'
import EmptyState from '../ui/EmptyState'
import Alert from '../ui/Alert'
import { inputClass } from '../ui/FormField'

// Explore -- Pressure Map (frontend sitemap doc, Page 7). The IsobarMap
// metaphor generalised to the whole country (UI/UX doc §7.1): every tracked
// destination plotted at its real position on a real India outline, each as
// a breathing pressure ring -- no login, no specific trip request required.
// Zoom/pan on the map itself is how someone tells clustered destinations
// apart, rather than a separate list duplicating what's already on screen.
export default function PressureHeatmap() {
  const { date, rows, isLoadingMap, error, setDate, fetchMap } = usePressureStore()

  useEffect(() => {
    fetchMap()
  }, [fetchMap])

  return (
    <div>
      <PageHeader icon={Activity} title="Explore — pressure map" description="How busy every tracked destination is expected to be on a given date. Scroll or pinch to zoom in on a cluster; hover a ring for its name and score." />

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
        <GoogleIndiaMap rows={rows} />
      )}
    </div>
  )
}
