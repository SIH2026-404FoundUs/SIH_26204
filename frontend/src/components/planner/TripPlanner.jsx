import { useState } from 'react'
import { Loader2, MapPin, Calendar, Users, Wallet, Navigation } from 'lucide-react'
import { usePlannerStore } from '../../store/usePlannerStore'
import { scoreColor } from '../pressure/scoreColor'

function Input({ icon: Icon, label, type = 'text', value, onChange, placeholder }) {
  return (
    <label className="block text-left">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      <span className="relative block">
        {Icon && <Icon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />}
        <input
          type={type} value={value} onChange={onChange} placeholder={placeholder} required
          className={`w-full rounded-lg border border-slate-200 bg-white py-2 ${Icon ? 'pl-9' : 'pl-3'} pr-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100`}
        />
      </span>
    </label>
  )
}

function TripForm({ onSubmit, isPlanning }) {
  const [form, setForm] = useState({
    destId: 'manali', startDate: '', endDate: '', origin: '', travellers: 2, budgetInr: 20000,
  })
  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))

  return (
    <form
      className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      onSubmit={(e) => { e.preventDefault(); onSubmit(form) }}
    >
      <Input icon={MapPin} label="Destination id" value={form.destId} onChange={set('destId')} placeholder="manali" />
      <Input icon={Navigation} label="Travelling from" value={form.origin} onChange={set('origin')} placeholder="New Delhi" />
      <Input icon={Calendar} label="Start date" type="date" value={form.startDate} onChange={set('startDate')} />
      <Input icon={Calendar} label="End date" type="date" value={form.endDate} onChange={set('endDate')} />
      <Input icon={Users} label="Travellers" type="number" value={form.travellers} onChange={set('travellers')} />
      <Input icon={Wallet} label="Budget (INR)" type="number" value={form.budgetInr} onChange={set('budgetInr')} />
      <div className="sm:col-span-2">
        <button
          type="submit" disabled={isPlanning}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPlanning && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
          Plan my trip
        </button>
      </div>
    </form>
  )
}

function AlternativeCard({ label, destId, date, pressure, savingINR, onSelect }) {
  return (
    <button
      type="button" onClick={onSelect}
      className="block w-full rounded-lg border border-slate-200 p-3 text-left transition hover:border-indigo-400 hover:shadow-sm"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-800">{label}</span>
        {pressure != null && (
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: scoreColor(pressure) }} />
        )}
      </div>
      {pressure != null && <div className="mt-1 text-xs text-slate-500">pressure {pressure.toFixed(2)}</div>}
      {savingINR > 0 && <div className="text-xs text-emerald-600">save ~₹{savingINR}</div>}
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
    <div className="space-y-4 rounded-xl border border-amber-200 bg-amber-50 p-5">
      <div>
        <h3 className="text-sm font-semibold text-amber-900">
          This destination is at pressure {pressure?.score?.toFixed(2) ?? '—'} — that's crowded.
        </h3>
        <p className="mt-1 text-sm text-amber-800">
          Here are less-crowded options. You can pick one, or continue with your original plan anyway.
        </p>
      </div>

      {places.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-amber-700">Alternative places</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {places.map((p) => (
              <AlternativeCard
                key={p.destId} label={p.displayName || p.destId} pressure={p.pressure} savingINR={p.savingINR}
                onSelect={() => submitDecision('accept', { destId: p.destId })}
              />
            ))}
          </div>
        </div>
      )}

      {dates.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-amber-700">Alternative dates, same destination</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {dates.map((d) => (
              <AlternativeCard
                key={d.startDate} label={d.startDate} pressure={d.pressure} savingINR={d.savingINR}
                onSelect={() => submitDecision('accept', { destId: usePlannerStore.getState().request.dest_id, date: d.startDate })}
              />
            ))}
          </div>
        </div>
      )}

      {places.length === 0 && dates.length === 0 && (
        <p className="text-sm text-amber-700">No better place or date was found — continuing anyway is the only option here.</p>
      )}

      <button
        type="button" disabled={isPlanning} onClick={() => submitDecision('decline')}
        className="w-full rounded-lg border border-amber-300 bg-white py-2 text-sm font-medium text-amber-900 transition hover:bg-amber-100 disabled:opacity-60"
      >
        Continue with original destination anyway
      </button>
    </div>
  )
}

function PlanResult() {
  const { plan } = usePlannerStore()
  if (!plan || plan.status !== 'ok') return null
  const { redistribution, alternativesOffered, usedDeterministicFallback, plan: trip } = plan

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">destId: {plan.destId}</span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{plan.date}</span>
        {alternativesOffered && (
          <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-indigo-700">
            redistribution: {redistribution?.kind ?? 'none'}
          </span>
        )}
        {usedDeterministicFallback && (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-700">assembled from tool results (planner text didn't validate)</span>
        )}
      </div>

      <p className="text-sm text-slate-700">{trip?.summary}</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {trip?.route && (
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <div className="font-medium text-slate-700">Route</div>
            <div className="text-slate-500">{trip.route.distanceKm} km · {trip.route.durationMinutes} min</div>
          </div>
        )}
        {trip?.weather && (
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <div className="font-medium text-slate-700">Weather</div>
            <div className="text-slate-500">{trip.weather.maxTemp}°C · {trip.weather.precipProb}% rain</div>
          </div>
        )}
        {trip?.costBreakdown && (
          <div className="rounded-lg bg-slate-50 p-3 text-sm sm:col-span-2">
            <div className="font-medium text-slate-700">Cost estimate</div>
            <div className="text-slate-500">
              grand total ₹{trip.costBreakdown.grandTotal} (incl. ₹{trip.costBreakdown.contingency} contingency) — always an estimate
            </div>
          </div>
        )}
      </div>

      {trip?.itinerary?.days?.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Itinerary</div>
          {trip.itinerary.days.map((day) => (
            <div key={day.day} className="rounded-lg border border-slate-100 p-3 text-sm">
              <div className="font-medium text-slate-700">Day {day.day}</div>
              <div className="text-slate-500">{day.stops?.length ?? 0} stop(s)</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function TripPlanner() {
  const { submitTrip, isPlanning, awaitingDecision, error, plan, clearError, reset } = usePlannerStore()

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <TripForm onSubmit={submitTrip} isPlanning={isPlanning} />
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}{' '}
          <button type="button" onClick={clearError} className="font-medium underline">dismiss</button>
        </p>
      )}

      {awaitingDecision && <DecisionPanel />}
      {plan && <PlanResult />}
      {plan && (
        <button type="button" onClick={reset} className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
          Plan another trip
        </button>
      )}
    </div>
  )
}
