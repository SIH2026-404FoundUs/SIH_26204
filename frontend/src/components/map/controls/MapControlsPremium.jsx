import { useEffect, useState } from 'react'
import { ArrowRight, CalendarDays, ChevronDown, LocateFixed, MapPin, Minus, Navigation, Plus, Sparkles, Loader2, Milestone, SlidersHorizontal, WalletCards } from 'lucide-react'
import { useDestinationsStore } from '../../../store/useDestinationsStore'
import TravelModeSelector from './TravelModeSelector'
import { TRAVEL_MODES } from '../travelModes'

// No display utility here: each group adds its own `flex` or the
// collapsible `hidden @3xl:flex`, so the two never fight in one class list.
const groupClass = 'min-w-0 items-center rounded-xl border border-slate-200/80 bg-white/70 transition focus-within:border-[#6C63FF]/50 focus-within:bg-white focus-within:ring-4 focus-within:ring-[#6C63FF]/10'
const inputClass = 'min-w-0 bg-transparent text-xs font-bold text-slate-900 outline-none placeholder:font-semibold placeholder:text-slate-400'
const labelClass = 'block text-[9px] font-extrabold uppercase leading-none tracking-wider text-slate-400'

function Field({ icon: Icon, label, children, className = '' }) {
  return (
    <label className={`flex min-w-0 items-center gap-2 px-2.5 py-1.5 ${className}`}>
      <Icon size={15} className="shrink-0 text-slate-400" />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className={labelClass}>{label}</span>
        {children}
      </span>
    </label>
  )
}

/**
 * MapControlsPremium - The command bar across the top of the one-map page.
 *
 * Sized by the map container (@container queries), not the viewport. Wide
 * maps show every field, wrapping onto extra rows as needed. Narrow maps
 * (< @3xl) keep From -> To and Plan visible and fold dates, travellers, budget,
 * mode and stops behind a one-line trip summary, so the bar doesn't bury the
 * map under four rows of inputs. Map-display toggles are not here -- they
 * live in the layers popover on the map tool rail.
 */

function shortDate(value) {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}
export default function MapControlsPremium({ source = 'Delhi', useCurrentLocation = false, onChangeSource, destId = '', onChangeDestId, startDate = '2026-12-25', onChangeStartDate, endDate = '2026-12-28', onChangeEndDate, budgetInr = 20000, onChangeBudgetInr, travellers = 2, onChangeTravellers, travelMode = 'DRIVE', onChangeTravelMode, showStopsPanel = false, onToggleStopsPanel, stopsCount = 0, onDirectPlanTrip, isPlanning = false, plannerStage = '', onToggleCurrentLocation }) {
  const destinations = useDestinationsStore((state) => state.destinations)
  const fetchDestinations = useDestinationsStore((state) => state.fetchDestinations)
  useEffect(() => { fetchDestinations().catch(() => {}) }, [fetchDestinations])
  const items = destinations.length ? destinations.map((d) => ({ id: d._id || d.id, label: d.displayName || d.name || d._id })) : [{ id: 'manali', label: 'Manali, Himachal Pradesh' }, { id: 'shimla', label: 'Shimla, Himachal Pradesh' }, { id: 'dharamshala', label: 'Dharamshala, Himachal Pradesh' }]
  const count = Math.max(1, Number(travellers) || 1)
  const datesInvalid = Boolean(startDate && endDate && endDate < startDate)
  const planDisabledReason = !destId ? 'Choose a destination first' : datesInvalid ? 'End date is before the start date' : null
  const [detailsOpen, setDetailsOpen] = useState(false)
  const collapsible = detailsOpen ? 'flex' : 'hidden @3xl:flex'
  const modeLabel = (TRAVEL_MODES.find((m) => m.key === travelMode) || TRAVEL_MODES[0]).label

  return (
    <div className="relative overflow-hidden rounded-[20px] border border-white/70 bg-white/85 p-2 shadow-[0_20px_60px_rgba(15,23,42,.12)] backdrop-blur-2xl">
      <div className="flex flex-wrap items-stretch gap-2">
        {/* Where: origin -> destination */}
        <div className={`${groupClass} flex min-w-[min(100%,300px)] flex-[2_1_420px]`}>
          <button
            type="button"
            onClick={onToggleCurrentLocation}
            className={`ml-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition ${useCurrentLocation ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-200' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}
            title={useCurrentLocation ? 'Starting from your current location (click to type a place instead)' : 'Start from my current location'}
            aria-pressed={useCurrentLocation}
            aria-label="Start from my current location"
          >
            <LocateFixed size={15} />
          </button>
          <Field icon={Navigation} label={useCurrentLocation ? 'From · your location' : 'From'} className="flex-1 pl-1.5">
            <input aria-label="Origin" value={source} onChange={(e) => onChangeSource?.(e.target.value)} placeholder="City or address" className={`${inputClass} w-full truncate`} title={source} />
          </Field>
          <ArrowRight size={14} className="shrink-0 text-slate-300" aria-hidden="true" />
          <Field icon={MapPin} label="To" className="relative flex-1">
            <select aria-label="Destination" value={destId} onChange={(e) => onChangeDestId?.(e.target.value)} className={`${inputClass} w-full cursor-pointer appearance-none truncate pr-4 ${destId ? '' : 'text-slate-400'}`}>
              <option value="">Choose destination</option>
              {items.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
            <ChevronDown size={13} className="pointer-events-none absolute right-2.5 bottom-2 text-slate-400" aria-hidden="true" />
          </Field>
        </div>

        {/* Narrow maps: one-line summary that opens the trip details */}
        <button
          type="button"
          onClick={() => setDetailsOpen((open) => !open)}
          aria-expanded={detailsOpen}
          className={`flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border px-2.5 text-left text-[11px] font-semibold transition @3xl:hidden ${detailsOpen ? 'border-[#6C63FF]/40 bg-[#6C63FF]/8 text-[#5b52e6]' : datesInvalid ? 'border-rose-300 bg-rose-50/60 text-rose-700' : 'border-slate-200/80 bg-white/70 text-slate-600'}`}
        >
          <SlidersHorizontal size={15} className="shrink-0" />
          <span className="min-w-0 flex-1 truncate">
            {shortDate(startDate)} – {shortDate(endDate)} · {count} {count === 1 ? 'person' : 'people'} · {modeLabel}{stopsCount ? ` · ${stopsCount} stop${stopsCount > 1 ? 's' : ''}` : ''}
          </span>
          <ChevronDown size={14} className={`shrink-0 transition-transform ${detailsOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* When */}
        <div className={`${groupClass} ${collapsible} ${datesInvalid ? 'border-rose-300 bg-rose-50/60' : ''}`} title={datesInvalid ? 'End date is before the start date' : undefined}>
          <Field icon={CalendarDays} label="Dates">
            <span className="flex items-center gap-1">
              <input aria-label="Start date" type="date" value={startDate} onChange={(e) => onChangeStartDate?.(e.target.value)} className={`${inputClass} w-[6.9rem]`} />
              <span className="text-slate-300">–</span>
              <input aria-label="End date" type="date" min={startDate || undefined} value={endDate} onChange={(e) => onChangeEndDate?.(e.target.value)} className={`${inputClass} w-[6.9rem] ${datesInvalid ? 'text-rose-600' : ''}`} />
            </span>
          </Field>
        </div>

        {/* Who & budget */}
        <div className={`${groupClass} ${collapsible} divide-x divide-slate-200/70`}>
          <div className="flex items-center gap-2 px-2.5 py-1.5">
            <span className="flex flex-col gap-1">
              <span className={labelClass}>Travellers</span>
              <span className="flex items-center gap-1">
                <button type="button" onClick={() => onChangeTravellers?.(Math.max(1, count - 1))} disabled={count <= 1} className="flex h-4 w-4 items-center justify-center rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label="Fewer travellers"><Minus size={11} /></button>
                <span className="w-5 text-center text-xs font-bold tabular-nums text-slate-900" aria-live="polite">{count}</span>
                <button type="button" onClick={() => onChangeTravellers?.(Math.min(20, count + 1))} disabled={count >= 20} className="flex h-4 w-4 items-center justify-center rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label="More travellers"><Plus size={11} /></button>
              </span>
            </span>
          </div>
          <Field icon={WalletCards} label="Budget">
            <span className="flex items-center gap-0.5">
              <span className="text-xs font-bold text-slate-400">₹</span>
              <input aria-label="Budget in rupees" type="number" min="0" step="1000" value={budgetInr} onChange={(e) => onChangeBudgetInr?.(e.target.value)} className={`${inputClass} w-16 tabular-nums`} />
            </span>
          </Field>
        </div>

        {/* How */}
        <div className={`${collapsible} flex-wrap items-center gap-2`}>
          <TravelModeSelector value={travelMode} onChange={onChangeTravelMode} />
          <button
            type="button"
            onClick={() => onToggleStopsPanel?.(!showStopsPanel)}
            aria-pressed={showStopsPanel}
            className={`flex h-9 shrink-0 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-bold transition ${showStopsPanel ? 'border-[#6C63FF] bg-[#6C63FF] text-white' : 'border-slate-200/80 bg-white/70 text-slate-600 hover:bg-white hover:text-slate-900'}`}
            title="Add stops along the way"
          >
            <Milestone size={15} />
            Stops
            {stopsCount > 0 && <span className={`rounded-full px-1.5 text-[10px] ${showStopsPanel ? 'bg-white/25' : 'bg-slate-900 text-white'}`}>{stopsCount}</span>}
          </button>
        </div>

        <button
          type="button"
          onClick={() => onDirectPlanTrip?.()}
          disabled={isPlanning || Boolean(planDisabledReason)}
          title={planDisabledReason || 'Plan this trip with AI'}
          className="ml-auto flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-extrabold text-white shadow-lg shadow-slate-950/15 transition hover:bg-[#6C63FF] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
        >
          {isPlanning ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          <span className="min-w-0 truncate">{isPlanning ? (plannerStage || 'Planning…') : 'Plan with AI'}</span>
        </button>
      </div>

      {isPlanning && (
        <div className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-[#6C63FF]/15" aria-hidden="true">
          <div className="h-full w-1/3 animate-pulse bg-[#6C63FF]" />
        </div>
      )}
    </div>
  )
}
