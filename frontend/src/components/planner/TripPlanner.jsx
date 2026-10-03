import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, Users, Wallet, Navigation, Compass, Check, X, CalendarClock, Map as MapIcon, CloudSun, Hotel, ShieldCheck, Route as RouteIcon } from 'lucide-react'
import { itineraryStopName } from '../../lib/itineraryStop'
import { usePlannerStore } from '../../store/usePlannerStore'
import { useTrustStore } from '../../store/useTrustStore'
import PressureRing from '../pressure/PressureRing'
import PressureBadge from '../pressure/PressureBadge'
import { getDestinationLabel } from '../../lib/destinations'
import PageHeader from '../ui/PageHeader'
import Card from '../ui/Card'
import Button from '../ui/Button'
import Alert from '../ui/Alert'
import FormField, { inputClass } from '../ui/FormField'
import DestinationSelect from '../ui/DestinationSelect'

function TripForm({ onSubmit, isPlanning }) {
  const [form, setForm] = useState({
    destId: '', startDate: '', endDate: '', origin: '', travellers: 2, budgetInr: 20000,
  })
  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))

  // "How many people have suggested places worth visiting nearby" -- a real
  // geo-count over approved Suggest a Place submissions within ~30km of
  // this destination (GET /community/nearby-count), not a fabricated number.
  const fetchNearbySuggestionCount = useTrustStore((s) => s.fetchNearbySuggestionCount)
  useEffect(() => {
    if (form.destId) fetchNearbySuggestionCount(form.destId)
  }, [form.destId, fetchNearbySuggestionCount])

  return (
    <form className="grid grid-cols-1 gap-5 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); onSubmit(form) }}>
      <div className="sm:col-span-2 mb-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-relief">Start a considered trip</p>
        <h2 className="mt-1 font-display text-2xl tracking-tight text-ink">Tell us what you’re planning.</h2>
        <p className="mt-1 text-sm leading-6 text-ink/60">We’ll check pressure, route, weather, stays and your budget before shaping the days.</p>
      </div>
      <FormField label="Destination"><DestinationSelect required value={form.destId} onChange={(v) => setForm((p) => ({ ...p, destId: v }))} /></FormField>
      <FormField label="Travelling from">
        <div className="relative">
          <Navigation size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ash" aria-hidden="true" />
          <input required value={form.origin} onChange={set('origin')} placeholder="e.g. New Delhi" className={`${inputClass} pl-9`} />
        </div>
      </FormField>
      <FormField label="Start date">
        <div className="relative">
          <Calendar size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ash" aria-hidden="true" />
          <input required type="date" value={form.startDate} onChange={set('startDate')} className={`${inputClass} pl-9`} />
        </div>
      </FormField>
      <FormField label="End date">
        <div className="relative">
          <Calendar size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ash" aria-hidden="true" />
          <input required type="date" value={form.endDate} onChange={set('endDate')} className={`${inputClass} pl-9`} />
        </div>
      </FormField>
      <FormField label="Travellers">
        <div className="relative">
          <Users size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ash" aria-hidden="true" />
          <input required type="number" min="1" value={form.travellers} onChange={set('travellers')} className={`${inputClass} pl-9`} />
        </div>
      </FormField>
      <FormField label="Budget (INR)">
        <div className="relative">
          <Wallet size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ash" aria-hidden="true" />
          <input required type="number" min="0" value={form.budgetInr} onChange={set('budgetInr')} className={`${inputClass} pl-9`} />
        </div>
      </FormField>
      <div className="sm:col-span-2">
        <Button type="submit" variant="primary" fullWidth loading={isPlanning}>Check pressure &amp; plan</Button>
      </div>
    </form>
  )
}

function AlternativeRow({ label, icon: Icon, pressure, requestedPressure, savingINR, selected, onSelect }) {
  const pressureDrop = typeof requestedPressure === 'number' && typeof pressure === 'number'
    ? requestedPressure - pressure
    : null

  return (
    <button type="button" aria-pressed={selected} onClick={onSelect} className={`flex w-full items-center justify-between gap-3 rounded-lg border bg-white p-3 text-left transition hover:border-ink/25 hover:shadow-sm ${selected ? 'border-relief ring-2 ring-relief/20' : 'border-paper-dim'}`}>
      <div className="flex items-center gap-2.5">
        {Icon && <Icon size={16} className="text-ash shrink-0" aria-hidden="true" />}
        <span className="text-sm font-medium text-ink">{label}</span>
      </div>
      <div className="flex items-center gap-3">
        {pressure != null && <PressureBadge score={pressure} size="sm" />}
        {pressureDrop > 0 && <span className="text-xs text-relief">{Math.round(pressureDrop * 100)}pt lower</span>}
        {/* Saving is shown only when genuinely nonzero -- matching the
            backend's own honesty convention (a date shift with
            savingINR: 0 does not invent a saving to display). */}
        {savingINR > 0 && <span className="text-xs font-medium text-relief">↓ ₹{savingINR.toLocaleString('en-IN')}</span>}
      </div>
    </button>
  )
}

// The pressure-gate decision step (UI/UX doc §4.2): never auto-redirects.
// The traveller sees the reading and the alternatives and must explicitly
// accept or decline -- both buttons carry equal size, weight, and an icon,
// per the doc's central integrity rule.
function itineraryStopLabel(stop) {
  if (stop?.slot === 'start') return 'Start from'
  if (stop?.slot === 'end') return 'Return to'
  return stop?.time || stop?.slot || 'Visit'
}

function DecisionPanel() {
  const { pressure, alternatives, submitDecision, isPlanning } = usePlannerStore()
  const [selectedAlternative, setSelectedAlternative] = useState(null)
  const places = alternatives?.places ?? []
  const dates = alternatives?.dates ?? []
  const destLabel = getDestinationLabel(alternatives?.requested?.destId)
  const requestedPressure = alternatives?.requested?.pressure ?? pressure?.score

  return (
    <div className="isobar-canvas rounded-lg p-5 sm:p-6">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <PressureRing score={pressure?.score} variant="requested" size={96} />
        <div className="flex-1 text-center sm:text-left">
          <h3 className="font-display text-xl text-paper">Your selected destination currently has high tourism pressure.</h3>
          <p className="mt-1 text-sm text-paper/70">{destLabel} is the destination you selected.</p>
          <div className="mt-1"><PressureBadge score={pressure?.score} size="lg" /></div>
          <p className="mt-2 text-sm text-paper/60">Here are less-crowded options. Pick one, or continue with your original plan anyway -- declining is a first-class outcome here, not a mistake to talk you out of.</p>
        </div>
      </div>

      {places.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-paper/50">Other destinations</div>
          <div className="space-y-2">
            {places.map((p) => (
              <AlternativeRow key={p.destId} label={p.displayName || getDestinationLabel(p.destId)} pressure={p.pressure} requestedPressure={requestedPressure} savingINR={p.savingINR}
                selected={selectedAlternative?.destId === p.destId} onSelect={() => setSelectedAlternative({ destId: p.destId })} />
            ))}
          </div>
        </div>
      )}

      {dates.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-paper/50">Other dates, same destination</div>
          <div className="space-y-2">
            {dates.map((d) => (
              <AlternativeRow key={d.startDate} icon={CalendarClock}
                label={new Date(d.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                pressure={d.pressure} requestedPressure={requestedPressure} savingINR={d.savingINR}
                selected={selectedAlternative?.date === d.startDate} onSelect={() => setSelectedAlternative({ date: d.startDate })} />
            ))}
          </div>
        </div>
      )}

      {places.length === 0 && dates.length === 0 && (
        <p className="mt-5 text-sm text-paper/60">No better place or date was found -- continuing anyway is the only option here.</p>
      )}

      {alternatives?.relaxedRelief && (
        <p className="mt-4 text-xs text-paper/60">These suggestions meet a relaxed relief threshold, so the improvement may be modest.</p>
      )}

      {(pressure?.lowConfidence || pressure?.stale || pressure?.dropped?.length > 0 || pressure?.degraded?.length > 0) && (
        <p className="mt-4 text-xs text-paper/60">
          {pressure.stale ? 'This reading uses the latest available stored data. ' : ''}
          {pressure.lowConfidence ? 'The reading has lower confidence. ' : ''}
          {pressure.degraded?.length > 0 ? 'Some signals use fallback data. ' : ''}
          {pressure.dropped?.length > 0 ? 'Some pressure signals were unavailable.' : ''}
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Button variant="outline" icon={Check} loading={isPlanning} disabled={!selectedAlternative}
          onClick={() => submitDecision('accept', selectedAlternative)} className="border-paper/30 text-paper hover:bg-paper/10">
          Take the relief
        </Button>
        <Button variant="outline" icon={X} loading={isPlanning} onClick={() => submitDecision('decline')}
          className="border-paper/30 text-paper hover:bg-paper/10">
          Go to {destLabel} anyway
        </Button>
      </div>
    </div>
  )
}

function PlanResult() {
  const { plan, request, pressure, submitTrip, isPlanning } = usePlannerStore()
  const [selectedAlternative, setSelectedAlternative] = useState(null)
  if (!plan) return null
  const { trip, redistribution, destId, startDate } = plan
  const switched = redistribution?.kind && redistribution.kind !== 'none'
  const swapOffers = trip?.alternatives?.swapOffers
  const destinationSwap = swapOffers?.destination_swap
  const dateSwap = swapOffers?.date_swap
  const hasSwapOffers = Boolean(destinationSwap || dateSwap)
  const decisionAlternatives = plan?.alternatives
  const alternativePlaces = decisionAlternatives?.places || []
  const alternativeDates = decisionAlternatives?.dates || []
  const hasDecisionAlternatives = alternativePlaces.length > 0 || alternativeDates.length > 0
  const formatDate = (value) => value
    ? new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Unavailable'

  const applySelectedAlternative = async () => {
    if (!selectedAlternative || !request) return
    await submitTrip({
      origin: request.origin,
      destId: selectedAlternative.destId || request.destId,
      startDate: selectedAlternative.startDate || request.startDate,
      endDate: selectedAlternative.endDate || request.endDate,
      travellers: request.travellers,
      budgetInr: request.budgetINR,
      interests: request.interests,
    })
  }

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-display text-lg text-ink">{getDestinationLabel(destId)}</span>
          <span className="font-mono text-xs text-ash">{startDate}</span>
        </div>
        {switched ? (
          <span className="text-xs font-medium text-relief">
            redirected{redistribution.savingINR > 0 ? ` · saved ₹${redistribution.savingINR.toLocaleString('en-IN')}` : ''}
          </span>
        ) : (
          <span className="text-xs font-medium text-pressure">proceeding as requested · pressure disclosed</span>
        )}
      </div>

      <div className="mb-4 rounded-lg bg-paper-dim/50 p-3 text-sm text-ink/70">
        <div><span className="font-medium text-ink/80">Requested:</span> {getDestinationLabel(request?.destId)} · {request?.startDate}</div>
        {switched && (
          <div className="mt-1">
            <span className="font-medium text-relief">Redistributed:</span>{' '}
            {redistribution.pressureBefore != null && redistribution.pressureAfter != null
              ? `${Math.round(redistribution.pressureBefore * 100)}% → ${Math.round(redistribution.pressureAfter * 100)}% pressure`
              : 'alternative accepted'}
            {redistribution.savingINR > 0 && ` · saved ₹${redistribution.savingINR.toLocaleString('en-IN')}`}
          </div>
        )}
        {!switched && pressure?.score != null && <div className="mt-1">Original pressure: {Math.round(pressure.score * 100)}% · proceeding as requested</div>}
      </div>

      <p className="text-sm text-ink/70">{trip?.summary}</p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {trip?.route && (
          <div className="rounded-lg bg-paper-dim/50 p-3 text-sm">
            <div className="font-medium text-ink/80">Route</div>
            <div className="font-mono text-ink/60">{trip.route.distanceKm} km · {trip.route.durationMinutes} min</div>
          </div>
        )}
        {trip?.weather && (
          <div className="rounded-lg bg-paper-dim/50 p-3 text-sm">
            <div className="font-medium text-ink/80">Weather</div>
            <div className="font-mono text-ink/60">{trip.weather.maxTemp}°C · {trip.weather.precipProb}% chance of rain</div>
          </div>
        )}
        {trip?.costBreakdown?.grandTotal != null && (
          <div className="rounded-lg bg-paper-dim/50 p-3 text-sm sm:col-span-2">
            <div className="font-medium text-ink/80">Estimated cost</div>
            <div className="font-mono text-ink/60">
              ₹{trip.costBreakdown.grandTotal.toLocaleString('en-IN')}
              {trip.costBreakdown.contingency != null && ` total, including ₹${trip.costBreakdown.contingency.toLocaleString('en-IN')} contingency`}
              {' '}— an estimate, not a live quote
            </div>
          </div>
        )}
      </div>

      {trip?.itinerary?.days?.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="text-xs font-medium uppercase tracking-wide text-ash">Day-by-day</div>
          {trip.itinerary.days.map((day) => (
            <div key={day.day} className="rounded-lg border border-paper-dim p-3 text-sm">
              <div className="font-medium text-ink/80">Day {day.day}</div>
              <div className="mt-2 space-y-2">
                {(day.stops || []).map((stop, index) => (
                  <div key={`${itineraryStopName(stop)}-${index}`} className="flex items-start gap-3 rounded-md bg-paper-dim/40 px-2.5 py-2">
                    <span className="w-20 shrink-0 text-xs font-medium text-ash">{itineraryStopLabel(stop)}</span>
                    <div className="min-w-0">
                      <div className="font-medium text-ink/80">{itineraryStopName(stop)}</div>
                      {stop?.activity && <div className="mt-0.5 text-xs text-ink/50">{stop.activity}</div>}
                      {typeof stop?.estimatedDuration === 'number' && <div className="mt-0.5 text-xs text-ink/40">About {stop.estimatedDuration} minutes</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {!trip?.itinerary?.days?.length && (
        <p className="mt-4 text-sm text-ink/60">Detailed day-by-day itinerary was not returned for this plan.</p>
      )}

      {hasSwapOffers && (
        <div className="mt-5 rounded-lg border border-relief/25 bg-relief/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-relief">Quieter alternatives</div>
              <p className="mt-1 text-xs text-ink/60">Optional verified suggestions for this destination and trip window.</p>
            </div>
            <span className="text-xs font-medium text-relief">No automatic changes</span>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {destinationSwap && (
              <button type="button" aria-pressed={selectedAlternative?.kind === 'destination'} onClick={() => setSelectedAlternative({ kind: 'destination', destId: destinationSwap.alternative_destination })} className={`w-full rounded-lg border bg-white p-3 text-left transition ${selectedAlternative?.kind === 'destination' ? 'border-relief ring-2 ring-relief/25' : 'border-paper-dim hover:border-relief/60'}`}>
                <div className="text-xs font-medium uppercase tracking-wide text-ash">Destination</div>
                <div className="mt-1 font-medium text-ink">{destinationSwap.alternative_name || destinationSwap.alternative_destination}</div>
                {destinationSwap.pressure_after != null && <div className="mt-1 text-xs text-relief">{Math.round(destinationSwap.pressure_after * 100)}% pressure</div>}
                {destinationSwap.reason?.length > 0 && <div className="mt-1 text-xs text-ink/60">{destinationSwap.reason.join(' · ')}</div>}
              </button>
            )}
            {dateSwap && (
              <button type="button" aria-pressed={selectedAlternative?.kind === 'date'} onClick={() => setSelectedAlternative({ kind: 'date', startDate: dateSwap.alternative_dates?.[0], endDate: dateSwap.alternative_dates?.[1] })} className={`w-full rounded-lg border bg-white p-3 text-left transition ${selectedAlternative?.kind === 'date' ? 'border-relief ring-2 ring-relief/25' : 'border-paper-dim hover:border-relief/60'}`}>
                <div className="text-xs font-medium uppercase tracking-wide text-ash">Alternative dates</div>
                <div className="mt-1 font-medium text-ink">
                  {formatDate(dateSwap.alternative_dates?.[0])}
                  {dateSwap.alternative_dates?.[1] && ` – ${formatDate(dateSwap.alternative_dates[1])}`}
                </div>
                {dateSwap.pressure_after != null && <div className="mt-1 text-xs text-relief">{Math.round(dateSwap.pressure_after * 100)}% pressure</div>}
                {dateSwap.reason?.length > 0 && <div className="mt-1 text-xs text-ink/60">{dateSwap.reason.join(' · ')}</div>}
              </button>
            )}
          </div>
          {selectedAlternative && <button type="button" onClick={applySelectedAlternative} disabled={isPlanning} className="mt-3 w-full rounded-lg bg-relief px-3 py-2 text-xs font-semibold text-white transition hover:bg-relief/90 disabled:opacity-60">{isPlanning ? 'Applying alternative…' : 'Apply selected alternative'}</button>}
        </div>
      )}

      {hasDecisionAlternatives && (
        <div className="mt-5 rounded-lg border border-pressure/25 bg-pressure/5 p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-pressure">Alternatives offered</div>
          <p className="mt-1 text-xs text-ink/60">These were available before continuing with the requested plan.</p>
          {alternativePlaces.length > 0 && (
            <div className="mt-3">
              <div className="text-xs font-medium text-ink/70">Other destinations</div>
              <div className="mt-2 space-y-2">
                {alternativePlaces.map((place) => (
                  <div key={place.destId} className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2 text-sm">
                    <span className="font-medium text-ink/80">{place.displayName || place.destId}</span>
                    {place.pressure != null && <span className="text-xs text-relief">{Math.round(place.pressure * 100)}% pressure</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {alternativeDates.length > 0 && (
            <div className="mt-3">
              <div className="text-xs font-medium text-ink/70">Quieter dates</div>
              <div className="mt-2 space-y-2">
                {alternativeDates.map((dateOption) => (
                  <div key={dateOption.startDate} className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2 text-sm">
                    <span className="font-medium text-ink/80">{formatDate(dateOption.startDate)}</span>
                    {dateOption.pressure != null && <span className="text-xs text-relief">{Math.round(dateOption.pressure * 100)}% pressure</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

export default function TripPlanner() {
  const { submitTrip, isPlanning, awaitingDecision, error, plan, clearError, reset } = usePlannerStore()

  return (
    <div className="mx-auto max-w-6xl">
      <section className="relative mb-8 overflow-hidden rounded-2xl bg-ink px-6 py-8 text-paper shadow-[0_20px_60px_rgba(16,25,43,0.15)] sm:px-10 sm:py-10">
        <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full border-[32px] border-pressure/15" />
        <div className="pointer-events-none absolute -bottom-32 right-36 h-64 w-64 rounded-full border-[24px] border-relief/20" />
        <div className="relative max-w-2xl">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-paper/55"><Compass size={15} className="text-pressure" /> Sahyatri trip desk</div>
          <h1 className="font-display text-4xl leading-tight tracking-tight sm:text-5xl">Go somewhere good.<br /><span className="text-paper/60">Travel there thoughtfully.</span></h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-paper/70 sm:text-base">Build a trip around crowd pressure, route time, local weather, places to stay, and the budget you actually have.</p>
          <div className="mt-6 flex flex-wrap gap-2 text-xs text-paper/75"><span className="rounded-full border border-paper/15 bg-paper/10 px-3 py-1.5">Pressure-aware</span><span className="rounded-full border border-paper/15 bg-paper/10 px-3 py-1.5">Real places &amp; stays</span><span className="rounded-full border border-paper/15 bg-paper/10 px-3 py-1.5">Flexible by design</span></div>
        </div>
      </section>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
      <div>
      <div className="flex items-start justify-between gap-4">
        <PageHeader icon={Compass} title="Plan your next escape" description="A clear plan starts with a clear picture of the trip." />
        <Link
          to="/map"
          className="mt-1 flex shrink-0 items-center gap-1.5 rounded-lg border border-paper-dim bg-white px-3 py-2 text-xs font-medium text-ink/70 transition hover:border-ink/40"
        >
          <MapIcon size={14} aria-hidden="true" />
          Show in Maps
        </Link>
      </div>

      {!awaitingDecision && !plan && (
        <Card className="mb-6">
          <TripForm onSubmit={submitTrip} isPlanning={isPlanning} />
        </Card>
      )}

      {error && (
        <div className="mb-6">
          <Alert tone="error" action={<button type="button" onClick={clearError} className="text-xs font-medium underline">Dismiss</button>}>
            {error}
          </Alert>
        </div>
      )}

      {awaitingDecision && <div className="mb-6"><DecisionPanel /></div>}
      {plan && <div className="mb-4"><PlanResult /></div>}
      {plan && <Button variant="ghost" onClick={reset}>Plan another trip</Button>}
      </div>
      <aside className="space-y-4">
        <Card className="bg-white">
          <div className="mb-4 flex items-center gap-2"><div className="rounded-lg bg-relief/10 p-2 text-relief"><ShieldCheck size={18} /></div><h2 className="font-display text-xl">What you’ll get</h2></div>
          <div className="space-y-4">
            <div className="flex gap-3"><CloudSun size={17} className="mt-0.5 shrink-0 text-pressure" /><div><p className="text-sm font-semibold">Live trip signals</p><p className="mt-1 text-xs leading-5 text-ash">Weather, route time and pressure before you commit.</p></div></div>
            <div className="flex gap-3"><Hotel size={17} className="mt-0.5 shrink-0 text-relief" /><div><p className="text-sm font-semibold">Useful places to stay</p><p className="mt-1 text-xs leading-5 text-ash">Real hotel and local place data where available.</p></div></div>
            <div className="flex gap-3"><RouteIcon size={17} className="mt-0.5 shrink-0 text-ink/60" /><div><p className="text-sm font-semibold">A day-by-day rhythm</p><p className="mt-1 text-xs leading-5 text-ash">Morning, afternoon and evening ideas to follow.</p></div></div>
          </div>
        </Card>
        <Card className="border-relief/20 bg-relief/5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-relief">How it works</p>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-relief text-xs font-bold text-paper">1</span><span className="leading-6 text-ink/70">Enter destination, dates and budget.</span></div>
            <div className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-relief text-xs font-bold text-paper">2</span><span className="leading-6 text-ink/70">Review pressure and alternatives.</span></div>
            <div className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-relief text-xs font-bold text-paper">3</span><span className="leading-6 text-ink/70">Take the plan to One Map.</span></div>
          </div>
        </Card>
      </aside>
      </div>
    </div>
  )
}
