import { MapPin, Calendar, CheckCircle2, Info } from 'lucide-react'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import EmptyState from '../ui/EmptyState'
import PlaceSwapVariant from './PlaceSwapVariant'
import DateSwapVariant from './DateSwapVariant'
import DeclineButton from './DeclineButton'
import { getDestinationLabel } from '../../lib/destinations'

/**
 * Shows the crowding reading for the requested trip. Below a pressure of 0.65
 * there's nothing to switch to, so it just confirms the pick is fine; above
 * that it lays out real alternative places and dates side by side.
 */
export default function SwapCard({ data, onAcceptPlace, onAcceptDate, onDecline }) {
  if (!data || !data.requested) {
    return <EmptyState icon={Info} title="No crowding data yet" description="Run a search above to check this trip." />
  }

  const { requested, places = [], dates = [], relaxedRelief = false } = data
  const requestedName = requested.displayName || getDestinationLabel(requested.destId)
  const requestedPressure = typeof requested.pressure === 'number' ? requested.pressure : 0.5
  const pressurePercent = Math.round(requestedPressure * 100)
  const isLowPressure = requestedPressure <= 0.65

  if (isLowPressure) {
    return (
      <Card className="mx-auto max-w-2xl text-center" padding="p-8">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2 size={24} aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-xl font-semibold text-slate-900">{requestedName} looks good for these dates</h2>
        <p className="mt-2 text-sm text-slate-500">
          Crowding is estimated at {pressurePercent}% — low enough that there's no need to switch destination or date.
        </p>
        <Button variant="primary" className="mt-6" onClick={() => onDecline?.()}>
          Continue with {requestedName}
        </Button>
      </Card>
    )
  }

  const hasPlaces = places.length > 0
  const hasDates = dates.length > 0

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MapPin size={18} className="text-slate-400" aria-hidden="true" />
          <span className="font-semibold text-slate-900">{requestedName}</span>
          {relaxedRelief && <Badge tone="info">Showing close matches</Badge>}
        </div>
        <Badge tone="danger">{pressurePercent}% crowded</Badge>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <MapPin size={16} className="text-indigo-600" aria-hidden="true" />
            Other destinations ({places.length})
          </h3>
          {hasPlaces ? (
            <div className="space-y-3">
              {places.map((place) => (
                <PlaceSwapVariant key={place.destId || place.displayName} place={place} requestedPressure={requestedPressure} onAccept={onAcceptPlace} />
              ))}
            </div>
          ) : (
            <EmptyState title="No similar destination found" description="Nothing matched closely enough on interests and travel time." />
          )}
        </div>

        <div>
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <Calendar size={16} className="text-teal-600" aria-hidden="true" />
            Other dates ({dates.length})
          </h3>
          {hasDates ? (
            <div className="space-y-3">
              {dates.map((dateObj, idx) => (
                <DateSwapVariant key={dateObj.startDate || idx} dateObj={dateObj} requestedPressure={requestedPressure} onAccept={onAcceptDate} />
              ))}
            </div>
          ) : (
            <EmptyState title="No better date found" description="Nothing in the current window is meaningfully quieter." />
          )}
        </div>
      </div>

      <div className="border-t border-slate-200 pt-2">
        <DeclineButton onDecline={onDecline} requestedName={requestedName} />
      </div>
    </div>
  )
}
