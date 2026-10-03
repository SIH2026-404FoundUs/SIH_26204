import { Route } from 'lucide-react'
import Card from '../../ui/Card'
import LoadingState from '../../ui/LoadingState'
import EmptyState from '../../ui/EmptyState'
import Alert from '../../ui/Alert'

function Stat({ label, value, tone = 'ink' }) {
  return (
    <div>
      <p className="text-xs text-ash">{label}</p>
      <p className={`font-mono text-2xl font-semibold tabular-nums text-${tone}`}>{value}</p>
    </div>
  )
}

// Section 3 -- Redistribution Impact. Only trips with redistribution.kind
// != "none" ever count as redirected (dashboard spec §6) -- enforced
// server-side in services/dashboard/tripsAnalytics.js, not recomputed here.
export default function RedistributionImpact({ data, isLoading, error }) {
  const hasTrips = data && data.redirectedTrips > 0

  return (
    <Card className="mb-6">
      <h2 className="mb-4 text-sm font-semibold text-ink">Redistribution impact</h2>

      {error && <Alert tone="error">{error}</Alert>}

      {isLoading && !error && <LoadingState label="Aggregating trip records…" />}

      {!isLoading && !error && data && (
        !hasTrips ? (
          <EmptyState icon={Route} title="No redirected trips yet" description="This fills in as travellers accept pressure-relief alternatives through the platform." />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Stat label="Redirected trips" value={data.redirectedTrips.toLocaleString('en-IN')} tone="relief" />
              <Stat label="Total budget moved" value={`₹${data.totalBudgetMovedINR.toLocaleString('en-IN')}`} tone="pressure" />
              <Stat
                label="Average pressure relief"
                value={data.averagePressureRelief == null ? '—' : `${Math.round(data.averagePressureRelief * 100)} pts`}
                tone="relief"
              />
            </div>

            {data.byDestination.length > 0 && (
              <div className="mt-5 border-t border-paper-dim pt-4">
                <p className="mb-2 text-xs font-medium text-ink/80">Redistribution by destination</p>
                <ul className="space-y-1.5">
                  {data.byDestination.map((d) => (
                    <li key={d.destId} className="flex items-center justify-between text-sm">
                      <span className="text-ink">{d.displayName}</span>
                      <span className="font-mono tabular-nums text-ink/70">{d.count.toLocaleString('en-IN')}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )
      )}
    </Card>
  )
}
