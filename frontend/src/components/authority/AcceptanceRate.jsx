import { Percent } from 'lucide-react'
import Card from '../ui/Card'
import LoadingState from '../ui/LoadingState'
import EmptyState from '../ui/EmptyState'
import Alert from '../ui/Alert'

// Section 4 -- Acceptance Rate. THE formula (dashboard spec §7, mandatory):
//
//   acceptanceRate = count(redistribution.kind != "none") / count(alternativesOffered == true)
//
// NEVER accepted/totalTrips. The denominator is rendered directly under the
// percentage on purpose (spec: "the user should be able to understand
// exactly how the percentage was calculated") -- both numbers come straight
// from the backend response, nothing here recomputes the ratio.
export default function AcceptanceRate({ data, isLoading, error }) {
  return (
    <Card className="mb-6">
      <h2 className="mb-4 text-sm font-semibold text-ink">Acceptance rate</h2>

      {error && <Alert tone="error">{error}</Alert>}

      {isLoading && !error && <LoadingState label="Calculating acceptance rate…" />}

      {!isLoading && !error && data && (
        data.acceptanceRate == null ? (
          <EmptyState
            icon={Percent}
            title="No data available"
            description={
              data.alternativesOffered === 0
                ? 'No trip has been offered a pressure-relief alternative yet.'
                : 'Not enough data to compute an acceptance rate yet.'
            }
          />
        ) : (
          <div>
            <p className="font-mono text-5xl font-semibold tabular-nums text-relief">
              {(data.acceptanceRate * 100).toFixed(1)}%
            </p>
            <p className="mt-2 text-sm text-ink/60">
              <span className="font-mono tabular-nums text-ink">{data.accepted.toLocaleString('en-IN')}</span> accepted
              {' / '}
              <span className="font-mono tabular-nums text-ink">{data.alternativesOffered.toLocaleString('en-IN')}</span> alternatives offered
            </p>
          </div>
        )
      )}
    </Card>
  )
}
