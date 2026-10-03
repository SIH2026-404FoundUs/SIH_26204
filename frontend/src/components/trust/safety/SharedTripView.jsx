import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { MapPin, Calendar, ShieldOff } from 'lucide-react'
import { useTrustStore } from '../../../store/useTrustStore'
import { getDestinationLabel } from '../../../lib/destinations'
import PageHeader from '../../ui/PageHeader'
import Card from '../../ui/Card'
import Alert from '../../ui/Alert'
import LoadingState from '../../ui/LoadingState'

// Public, read-only Shareable Trip Record viewer (spec §5) -- reachable by
// anyone with the link, no account required (GET /v1/safety/trips/share/:token
// is mounted without protectRoute on purpose: the whole point is someone
// back home, with no Sahyatri account, can check on a traveller's plan).
// The backend projection is already PII-minimized server-side (no contact
// details, no payment info, no exact live location) -- this page just
// renders whatever it's handed, nothing extra is fetched or assumed.
export default function SharedTripView() {
  const { token } = useParams()
  const { sharedTrip, isLoadingSharedTrip, sharedTripError, fetchSharedTrip } = useTrustStore()

  useEffect(() => { if (token) fetchSharedTrip(token) }, [token, fetchSharedTrip])

  if (isLoadingSharedTrip) return <LoadingState label="Loading shared trip…" />

  if (sharedTripError) {
    return (
      <div className="mx-auto max-w-md">
        <Alert tone="error" action={<ShieldOff size={18} aria-hidden="true" />}>{sharedTripError}</Alert>
      </div>
    )
  }

  if (!sharedTrip) return null

  const stopsByDay = {}
  for (const stop of sharedTrip.stops || []) {
    const day = stop.dayIndex ?? 1
    stopsByDay[day] = stopsByDay[day] || []
    stopsByDay[day].push(stop)
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        icon={MapPin}
        title={sharedTrip.title || `Trip to ${getDestinationLabel(sharedTrip.destId)}`}
        description="Shared read-only itinerary -- no contact details or payment info included."
      />

      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink/70">
          <span className="flex items-center gap-1.5"><MapPin size={15} aria-hidden="true" /> {getDestinationLabel(sharedTrip.destId)}</span>
          {sharedTrip.startDate && (
            <span className="flex items-center gap-1.5">
              <Calendar size={15} aria-hidden="true" />
              {new Date(sharedTrip.startDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}
              {sharedTrip.endDate ? ` – ${new Date(sharedTrip.endDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}` : ''}
            </span>
          )}
        </div>
      </Card>

      {Object.keys(stopsByDay).length === 0 ? (
        <p className="text-sm text-ash">No stops were included in this share.</p>
      ) : (
        <div className="space-y-4">
          {Object.entries(stopsByDay).sort(([a], [b]) => Number(a) - Number(b)).map(([day, stops]) => (
            <div key={day}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ash">Day {day}</h2>
              <div className="space-y-2">
                {stops.map((s, i) => (
                  <Card key={`${day}-${i}`} padding="p-3">
                    <p className="text-sm font-medium text-ink">{s.name || 'Stop'}</p>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-8 text-center text-xs text-ash">This link can be revoked by its owner at any time.</p>
    </div>
  )
}
