import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Route as RouteIcon } from 'lucide-react'
import { useAuthStore } from '../../store/useAuthStore'
import { useTripsStore } from '../../store/useTripsStore'
import { getDestinationLabel } from '../../lib/destinations'
import { redistributionKindLabel, tripStateLabel } from '../../lib/labels'
import PageHeader from '../ui/PageHeader'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Alert from '../ui/Alert'
import LoadingState from '../ui/LoadingState'
import EmptyState from '../ui/EmptyState'

// Frontend sitemap doc, Page 6: a plain list of past plan-trip results, each
// row showing destination, dates, and -- importantly -- whether it was a
// redirect or a decline (redistribution.kind), the platform's own honest
// acceptance-rate data made visible to the traveller who generated it.
export default function MyTrips() {
  const authUser = useAuthStore((state) => state.authUser)
  const { trips, isLoading, error, fetchMyTrips } = useTripsStore()

  useEffect(() => {
    if (authUser) fetchMyTrips()
  }, [authUser, fetchMyTrips])

  return (
    <div>
      <PageHeader icon={RouteIcon} title="My trips" description="Every trip you've planned here, and whether it went as requested or was redistributed." />

      {error && <div className="mb-4"><Alert tone="error">{error}</Alert></div>}

      {isLoading ? (
        <LoadingState label="Loading your trips…" />
      ) : trips.length === 0 ? (
        <EmptyState
          icon={RouteIcon}
          title="No trips yet"
          description="Plan a trip and it'll show up here, including whether it was redirected to relieve crowding."
          action={<Link to="/home"><Button variant="primary">Plan a trip</Button></Link>}
        />
      ) : (
        <div className="space-y-3">
          {trips.map((trip) => {
            const redist = redistributionKindLabel(trip.redistribution?.kind)
            const state = tripStateLabel(trip.state)
            const dates = trip.finalDates?.startDate ? trip.finalDates : trip.requestedDates
            const destId = trip.redirectedToDestId || trip.requestedDestId
            return (
              <Card key={trip._id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-display text-lg text-ink">{getDestinationLabel(destId)}</span>
                  <div className="flex items-center gap-1.5">
                    <Badge tone={state.tone}>{state.label}</Badge>
                    <Badge tone={redist.tone}>{redist.label}</Badge>
                  </div>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-ash">
                  {dates?.startDate && (
                    <span className="font-mono tabular-nums">
                      {dates.startDate}{dates.endDate ? ` – ${dates.endDate}` : ''}
                    </span>
                  )}
                  {trip.travellers != null && <span>&middot; {trip.travellers} traveller{trip.travellers === 1 ? '' : 's'}</span>}
                  {trip.redistribution?.savingINR > 0 && (
                    <span className="text-relief">&middot; saved ₹{trip.redistribution.savingINR.toLocaleString('en-IN')}</span>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
