import { useState } from 'react'
import { Calendar, Users, Wallet, Navigation, Compass } from 'lucide-react'
import { usePlannerStore } from '../../store/usePlannerStore'
import { scoreColor } from '../pressure/scoreColor'
import { getDestinationLabel } from '../../lib/destinations'
import PageHeader from '../ui/PageHeader'
import Card from '../ui/Card'
import Button from '../ui/Button'
import Alert from '../ui/Alert'
import FormField, { inputClass } from '../ui/FormField'
import DestinationSelect from '../ui/DestinationSelect'

function TripForm({ onSubmit, isPlanning }) {
  const [form, setForm] = useState({
    destId: 'manali', startDate: '', endDate: '', origin: '', travellers: 2, budgetInr: 20000,
  })
  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))

  return (
    <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); onSubmit(form) }}>
      <FormField label="Destination"><DestinationSelect value={form.destId} onChange={(v) => setForm((p) => ({ ...p, destId: v }))} /></FormField>
      <FormField label="Travelling from">
        <div className="relative">
          <Navigation size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input required value={form.origin} onChange={set('origin')} placeholder="e.g. New Delhi" className={`${inputClass} pl-9`} />
        </div>
      </FormField>
      <FormField label="Start date">
        <div className="relative">
          <Calendar size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input required type="date" value={form.startDate} onChange={set('startDate')} className={`${inputClass} pl-9`} />
        </div>
      </FormField>
      <FormField label="End date">
        <div className="relative">
          <Calendar size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input required type="date" value={form.endDate} onChange={set('endDate')} className={`${inputClass} pl-9`} />
        </div>
      </FormField>
      <FormField label="Travellers">
        <div className="relative">
          <Users size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input required type="number" min="1" value={form.travellers} onChange={set('travellers')} className={`${inputClass} pl-9`} />
        </div>
      </FormField>
      <FormField label="Budget (INR)">
        <div className="relative">
          <Wallet size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input required type="number" min="0" value={form.budgetInr} onChange={set('budgetInr')} className={`${inputClass} pl-9`} />
        </div>
      </FormField>
      <div className="sm:col-span-2">
        <Button type="submit" variant="primary" fullWidth loading={isPlanning}>Plan my trip</Button>
      </div>
    </form>
  )
}

function AlternativeCard({ label, pressure, savingINR, onSelect }) {
  return (
    <button type="button" onClick={onSelect} className="block w-full rounded-xl border border-slate-200 p-3 text-left transition hover:border-indigo-400 hover:shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-800">{label}</span>
        {pressure != null && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: scoreColor(pressure) }} />}
      </div>
      {pressure != null && <div className="mt-1 text-xs text-slate-500">{Math.round(pressure * 100)}% estimated crowding</div>}
      {savingINR > 0 && <div className="text-xs text-emerald-600">Save ~₹{savingINR.toLocaleString('en-IN')}</div>}
    </button>
  )
}

// The pressure-gate decision step: never auto-redirects. The traveller sees
// the reading and the alternatives and must explicitly accept or decline.
function DecisionPanel() {
  const { pressure, alternatives, submitDecision, isPlanning } = usePlannerStore()
  const places = alternatives?.places ?? []
  const dates = alternatives?.dates ?? []

  return (
    <Card className="border-amber-200 bg-amber-50" padding="p-5">
      <h3 className="text-sm font-semibold text-amber-900">
        This destination is at {pressure?.score != null ? `${Math.round(pressure.score * 100)}%` : 'high'} estimated crowding.
      </h3>
      <p className="mt-1 text-sm text-amber-800">Here are less-crowded options. Pick one, or continue with your original plan anyway.</p>

      {places.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-amber-700">Other destinations</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {places.map((p) => (
              <AlternativeCard key={p.destId} label={p.displayName || getDestinationLabel(p.destId)} pressure={p.pressure} savingINR={p.savingINR}
                onSelect={() => submitDecision('accept', { destId: p.destId })} />
            ))}
          </div>
        </div>
      )}

      {dates.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-amber-700">Other dates, same destination</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {dates.map((d) => (
              <AlternativeCard key={d.startDate} label={new Date(d.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} pressure={d.pressure} savingINR={d.savingINR}
                onSelect={() => submitDecision('accept', { destId: usePlannerStore.getState().request.dest_id, date: d.startDate })} />
            ))}
          </div>
        </div>
      )}

      {places.length === 0 && dates.length === 0 && (
        <p className="mt-4 text-sm text-amber-700">No better place or date was found — continuing anyway is the only option here.</p>
      )}

      <Button variant="secondary" fullWidth loading={isPlanning} onClick={() => submitDecision('decline')} className="mt-4 border-amber-300 hover:bg-amber-100">
        Continue with original destination anyway
      </Button>
    </Card>
  )
}

function PlanResult() {
  const { plan } = usePlannerStore()
  if (!plan || plan.status !== 'ok') return null
  const { redistribution, plan: trip } = plan
  const switched = redistribution?.kind && redistribution.kind !== 'none'

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-slate-900">{getDestinationLabel(plan.destId)}</span>
        <span className="text-xs text-slate-400">{plan.date}</span>
        {switched && <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">Switched from your original pick</span>}
      </div>

      <p className="text-sm text-slate-700">{trip?.summary}</p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {trip?.route && (
          <div className="rounded-xl bg-slate-50 p-3 text-sm">
            <div className="font-medium text-slate-700">Route</div>
            <div className="text-slate-500">{trip.route.distanceKm} km · {trip.route.durationMinutes} min</div>
          </div>
        )}
        {trip?.weather && (
          <div className="rounded-xl bg-slate-50 p-3 text-sm">
            <div className="font-medium text-slate-700">Weather</div>
            <div className="text-slate-500">{trip.weather.maxTemp}°C · {trip.weather.precipProb}% chance of rain</div>
          </div>
        )}
        {trip?.costBreakdown && (
          <div className="rounded-xl bg-slate-50 p-3 text-sm sm:col-span-2">
            <div className="font-medium text-slate-700">Estimated cost</div>
            <div className="text-slate-500">
              ₹{trip.costBreakdown.grandTotal.toLocaleString('en-IN')} total, including ₹{trip.costBreakdown.contingency.toLocaleString('en-IN')} contingency — an estimate, not a live quote
            </div>
          </div>
        )}
      </div>

      {trip?.itinerary?.days?.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Day-by-day</div>
          {trip.itinerary.days.map((day) => (
            <div key={day.day} className="rounded-xl border border-slate-100 p-3 text-sm">
              <div className="font-medium text-slate-700">Day {day.day}</div>
              <div className="text-slate-500">{day.stops?.length ?? 0} stop(s)</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

export default function TripPlanner() {
  const { submitTrip, isPlanning, awaitingDecision, error, plan, clearError, reset } = usePlannerStore()

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader icon={Compass} title="Plan a trip" description="Tell us where and when -- we'll flag crowding before booking anything and build an itinerary." />

      <Card className="mb-6">
        <TripForm onSubmit={submitTrip} isPlanning={isPlanning} />
      </Card>

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
