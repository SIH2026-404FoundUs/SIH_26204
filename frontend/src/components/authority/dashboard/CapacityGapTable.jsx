import { TableProperties } from 'lucide-react'
import Card from '../../ui/Card'
import LoadingState from '../../ui/LoadingState'
import EmptyState from '../../ui/EmptyState'
import Alert from '../../ui/Alert'

// Section 2 -- Capacity Gap. Two DIFFERENT metrics, side by side, never
// merged or derived from one another (dashboard spec §5/§17):
//   normalizedCapacityGap -- Sathvik's pressure-side metric, normalised 0..1
//   roomDemandGap         -- Bharani's supply-side metric, a raw room count
//
// As of this build, both are genuinely absent from the database for every
// destination: `destination_demand` has no writer anywhere in the codebase,
// and `business_availability` has zero documents (see the backend's
// services/dashboard/capacityGap.js header comment for the full audit).
// Rather than compute either formula against a silent 0 -- which would
// produce a number that looks real but isn't -- the backend returns `null`
// per destination per metric, and this table renders that honestly as
// "No data" rather than a fabricated figure.
export default function CapacityGapTable({ data, isLoading, error }) {
  const rows = data?.destinations ?? []
  const hasAnyData = rows.some((r) => r.normalizedCapacityGap != null || r.roomDemandGap != null)

  return (
    <Card padding="p-0" className="mb-6">
      <div className="flex items-center justify-between gap-3 px-5 pt-5">
        <h2 className="text-sm font-semibold text-ink">Capacity gap</h2>
      </div>

      {error && <div className="px-5 pt-4"><Alert tone="error">{error}</Alert></div>}

      {isLoading ? (
        <div className="p-5"><LoadingState label="Loading capacity gap…" /></div>
      ) : error ? null : rows.length === 0 ? (
        <div className="p-5">
          <EmptyState icon={TableProperties} title="No data available for this date" />
        </div>
      ) : !hasAnyData ? (
        <div className="p-5">
          <EmptyState
            icon={TableProperties}
            title="No capacity data reported yet"
            description="Room demand (destination_demand) and business availability (business_availability) have no real submissions in this environment yet. The formulas are live and will populate the moment either data source starts receiving real writes -- these are not fabricated placeholder numbers."
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-t border-paper-dim text-left text-xs text-ash">
                <th className="px-5 py-3 font-medium">Destination</th>
                <th className="px-5 py-3 font-medium">Normalized capacity gap</th>
                <th className="px-5 py-3 font-medium">Room demand gap</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.destId} className="border-t border-paper-dim">
                  <td className="px-5 py-3 text-ink">{row.displayName}</td>
                  <td className="px-5 py-3 font-mono tabular-nums text-ink">
                    {row.normalizedCapacityGap == null ? <span className="text-ash">No data</span> : row.normalizedCapacityGap.toFixed(2)}
                  </td>
                  <td className="px-5 py-3 font-mono tabular-nums text-ink">
                    {row.roomDemandGap == null ? <span className="text-ash">No data</span> : row.roomDemandGap.toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
