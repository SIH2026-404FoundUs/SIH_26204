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
export default function SwapCard({ data, onAcceptPlace, onAcceptDate, onDecline, onPreview, onApply, onDismiss }) {
  if (data?.swapOffers) {
    // EverythingMap passes these as ordinary props; earlier callers nested
    // them inside `data`. Read both, or the card renders with three dead
    // buttons -- which is exactly how it behaved before.
    return (
      <GeneratedTripSwapCard
        offers={data.swapOffers}
        onPreview={onPreview || data.onPreview}
        onApply={onApply || data.onApply}
        onDismiss={onDismiss || data.onDismiss}
      />
    )
  }
  if (!data || !data.requested) {
    return <EmptyState icon={Info} title="No crowding data yet" description="Run a search above to check this trip." />
  }

  const { requested, places = [], dates = [], relaxedRelief = false } = data
  const requestedName = requested.displayName || getDestinationLabel(requested.destId)
  const requestedPressure = typeof requested.pressure === 'number' ? requested.pressure : 0.5
  const pressurePercent = Math.round(requestedPressure * 100)
  const isLowPressure = requestedPressure <= 0.6

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

function dateLabel(value) {
  if (!value) return '—'
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function rupees(value) {
  const amount = Number(value || 0)
  return `${amount < 0 ? '-' : ''}₹${Math.abs(amount).toLocaleString('en-IN')}`
}

function GeneratedTripSwapCard({ offers, onPreview, onApply, onDismiss }) {
  const destination = offers?.destination_swap
  const dates = offers?.date_swap
  const combined = offers?.combined
  if (!destination && !dates) return null
  const pressureBefore = destination?.pressure_before ?? dates?.pressure_before ?? combined?.pressure_before ?? 0
  if (pressureBefore <= 0.6) return null
  const both = Boolean(destination && dates)
  const title = both ? '⚠️ AI found a better plan' : destination ? '⚠️ Destination Swap' : '📅 Date Swap'
  const reasons = [...(destination?.reason || []), ...(dates?.reason || [])].filter((item, index, all) => all.indexOf(item) === index)

  return (
    <Card className="w-[min(440px,calc(100vw-2rem))] border-amber-200 bg-white/95 shadow-xl backdrop-blur-md" padding="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-600">Optional trip improvement</p>
          <h2 className="mt-1 text-base font-extrabold text-slate-900">{title}</h2>
        </div>
        <button type="button" onClick={onDismiss} className="rounded-full px-2 text-lg leading-none text-slate-400 hover:bg-slate-100" aria-label="Dismiss swap suggestion">×</button>
      </div>
      <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
        {destination && <p><span className="font-bold">Destination:</span> {destination.original_destination} → {destination.alternative_name || destination.alternative_destination}</p>}
        {dates && <p><span className="font-bold">Dates:</span> {dateLabel(dates.original_dates?.[0])}–{dateLabel(dates.original_dates?.[1])} → {dateLabel(dates.alternative_dates?.[0])}–{dateLabel(dates.alternative_dates?.[1])}</p>}
        {both && combined && <p className="font-bold text-emerald-700">Savings: ₹{Math.abs(Number(combined.budget_difference || 0)).toLocaleString('en-IN')} · Pressure: {Math.round((combined.pressure_before || 0) * 100)}% → {combined.pressure_after == null ? '—' : `${Math.round(combined.pressure_after * 100)}%`}</p>}
        {!both && destination && <p>Pressure: {Math.round((destination.pressure_before || 0) * 100)}% → {destination.pressure_after == null ? '—' : `${Math.round(destination.pressure_after * 100)}%`} · Budget: {rupees(destination.budget_difference)}</p>}
        {!both && dates && <p>Pressure: {Math.round((dates.pressure_before || 0) * 100)}% → {dates.pressure_after == null ? '—' : `${Math.round(dates.pressure_after * 100)}%`} · Budget: {rupees(dates.budget_difference)}</p>}
      </div>
      {reasons.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-5 text-xs leading-5 text-slate-600">{reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={onPreview}>Preview</Button>
        <Button variant="primary" onClick={onApply}>Apply</Button>
      </div>
    </Card>
  )
}
