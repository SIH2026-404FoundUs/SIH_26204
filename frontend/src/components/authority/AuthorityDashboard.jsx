import { useEffect } from 'react'
import { Landmark, TableProperties } from 'lucide-react'
import { useTripsStore } from '../../store/useTripsStore'
import PressureHeatmap from '../pressure/PressureHeatmap'
import PageHeader from '../ui/PageHeader'
import Card from '../ui/Card'
import Alert from '../ui/Alert'
import LoadingState from '../ui/LoadingState'
import EmptyState from '../ui/EmptyState'

function Stat({ label, value, tone = 'ink' }) {
  return (
    <div>
      <p className="text-xs text-ash">{label}</p>
      <p className={`font-mono text-2xl font-semibold tabular-nums text-${tone}`}>{value}</p>
    </div>
  )
}

// Frontend sitemap doc, Page 11 -- status PARTIAL. Ships today: the pressure
// map layer (Page 7's component, reused verbatim per UI/UX doc §7.1) and the
// redistribution-impact summary, now that GET /api/v1/trips/summary is real.
// Still genuinely missing: a per-destination capacity-gap table, which needs
// a destinations collection this project doesn't have -- marked "coming
// soon" rather than fabricated.
export default function AuthorityDashboard() {
  const { summary, isLoadingSummary, summaryError, fetchSummary } = useTripsStore()

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  return (
    <div>
      <PageHeader icon={Landmark} title="Authority dashboard" description="Destination pressure across the network, and how much of it the platform has actually redistributed." />

      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-ink">Redistribution impact</h2>
        {summaryError && <Alert tone="error">{summaryError}</Alert>}
        {isLoadingSummary && !summaryError && <LoadingState label="Aggregating trip records…" />}
        {!isLoadingSummary && !summaryError && summary && (
          summary.totalTrips === 0 ? (
            <EmptyState title="No trips recorded yet" description="This fills in as travellers plan trips through the platform." />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Total trips" value={summary.totalTrips} />
              <Stat label="Redirected" value={summary.redirectedPlace + summary.redirectedDate} tone="relief" />
              <Stat
                label="Acceptance rate"
                value={summary.acceptanceRate == null ? '—' : `${Math.round(summary.acceptanceRate * 100)}%`}
                tone="relief"
              />
              <Stat label="Budget moved" value={`₹${summary.totalBudgetINRMoved.toLocaleString('en-IN')}`} tone="pressure" />
            </div>
          )
        )}
      </Card>

      <Card padding="p-0" className="mb-6">
        <EmptyState
          icon={TableProperties}
          title="Capacity-gap table -- coming soon"
          description="Needs a destinations collection (capacity, typical demand per place) that doesn't exist in this project yet -- Ananya's destinations are seed JSON, not a queryable Mongo collection. Not fabricated in the meantime."
        />
      </Card>

      <PressureHeatmap />
    </div>
  )
}
