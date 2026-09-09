import { useState } from 'react'
import { Calendar, Users, Wallet, Navigation, Compass, Check, X, CalendarClock } from 'lucide-react'
import { usePlannerStore } from '../../store/usePlannerStore'
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

  return (
    <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); onSubmit(form) }}>
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
  const { plan, request, pressure } = usePlannerStore()
  if (!plan) return null
  const { trip, redistribution, destId, startDate } = plan
  const switched = redistribution?.kind && redistribution.kind !== 'none'

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
              <div className="text-ink/50">{day.stops?.length ?? 0} stop(s)</div>
            </div>
          ))}
        </div>
      )}
      {!trip?.itinerary?.days?.length && (
        <p className="mt-4 text-sm text-ink/60">Detailed day-by-day itinerary was not returned for this plan.</p>
      )}
    </Card>
  )
}

export default function TripPlanner() {
  const { submitTrip, isPlanning, awaitingDecision, error, plan, clearError, reset } = usePlannerStore()

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader icon={Compass} title="Where are you headed, and when?" description="We check how crowded it'll be before you book — not after." />

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
  )
}
