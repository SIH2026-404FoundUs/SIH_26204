import { MapPin, Calendar, CheckCircle2, Info, Navigation, ShieldCheck } from 'lucide-react'
import Card from '../ui/Card'
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
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-relief/10 text-relief">
          <CheckCircle2 size={24} aria-hidden="true" />
        </span>
        <h2 className="mt-4 font-display text-xl text-ink">{requestedName} looks good for these dates</h2>
        <p className="mt-2 text-sm text-ash">
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
      {/* Requested trip -- a flat ink surface, not glass (glass-surface is
          reserved for nav/overlays per the design doc; this is ordinary page
          content, so it stays a solid dark card like AuthScreen/LandingPage's
          hero treatment). */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-ink px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-paper/10 text-paper">
            <Navigation size={18} aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-medium text-paper/50">Your requested trip</p>
            <p className="font-display text-lg text-paper">{requestedName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {relaxedRelief && (
            <span className="rounded-full bg-paper/10 px-2.5 py-0.5 text-xs font-medium text-paper/80">Showing close matches</span>
          )}
          <span className="flex items-center gap-1 rounded-full bg-pressure/20 px-3 py-1 text-xs font-semibold text-pressure">
            <ShieldCheck size={12} aria-hidden="true" /> {pressurePercent}% crowded
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              <MapPin size={16} className="text-pressure" aria-hidden="true" />
              Alternative destinations ({places.length})
            </h3>
            <span className="text-xs text-ash">Same attributes, lower crowds</span>
          </div>
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
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              <Calendar size={16} className="text-relief" aria-hidden="true" />
              Alternative dates ({dates.length})
            </h3>
            <span className="text-xs text-ash">Same place, off-peak window</span>
          </div>
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

      <div className="border-t border-paper-dim pt-2">
        <DeclineButton onDecline={onDecline} requestedName={requestedName} />
      </div>
    </div>
  )
}
