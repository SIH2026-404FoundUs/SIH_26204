import { CalendarDays, ChevronDown, Download, Gauge, Hotel, Info, Loader2, Minus, Route, Sparkles, ThermometerSun, WalletCards, X } from 'lucide-react'
import { useState } from 'react'
import { usePlannerStore } from '../../../store/usePlannerStore'
import { useDestinationsStore } from '../../../store/useDestinationsStore'
import { API_BASE } from '../../../lib/api'
import { itineraryStopName } from '../../../lib/itineraryStop'
import { downloadTravelBrief } from '../../../lib/travelBrief'
import { scorePercent } from '../../pressure/scoreColor'
import TripExperiencePanel from './TripExperiencePanel'

function stopTime(stop) {
  if (stop?.time === 'start') return 'Start'
  if (stop?.time === 'end') return 'End'
  if (stop?.time) return stop.time
  const minutes = stop?.estimatedDuration
  return typeof minutes === 'number' ? `${minutes} min` : 'Visit'
}

export default function TripSummaryPremium({ plan, onClose }) {
  const request = usePlannerStore((state) => state.request)
  const destinations = useDestinationsStore((state) => state.destinations)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')
  // Two independent disclosures: `collapsed` shrinks the whole card to its
  // header so the map underneath stays usable, `showItinerary` reveals the
  // day-by-day list in place.
  const [collapsed, setCollapsed] = useState(false)
  const [showItinerary, setShowItinerary] = useState(false)

  if (!plan?.trip) return null
  const trip = plan.trip
  const destination = destinations.find((item) => (item._id || item.id) === (request?.destId || plan.destId))
  const stays = Array.isArray(trip.hotels) ? trip.hotels : (Array.isArray(trip.stays) ? trip.stays : [])
  const itineraryDays = Array.isArray(trip.itinerary) ? trip.itinerary : (Array.isArray(trip.itinerary?.days) ? trip.itinerary.days : [])
  const dataIssues = Array.isArray(trip.dataIssues) ? trip.dataIssues : []
  const photoUrl = (value) => !value ? '' : value.startsWith('http') ? value : value.startsWith('/api/') ? `${API_BASE}${value.slice(4)}` : value

  // Weather beyond the forecast horizon is a climate expectation, not a
  // prediction, so it is labelled rather than shown as if it were a forecast.
  const isSeasonal = trip.weather?.source === 'seasonal-normal'
  const weatherValue = trip.weather?.maxTemp != null ? `${trip.weather.maxTemp}°` : 'Unavailable'
  const weatherLabel = trip.weather?.maxTemp == null ? 'no data' : isSeasonal ? 'seasonal avg' : 'forecast'

  const grandTotal = trip.costBreakdown?.grandTotal ?? trip.costBreakdown?.totalCost
  const budgetValue = grandTotal != null ? `₹${Number(grandTotal).toLocaleString('en-IN')}` : 'Unavailable'

  const metric = (Icon, value, label, color = 'text-[#6C63FF]') => (
    <div className="metric-tile">
      <Icon size={14} className={color} />
      <span className="mt-2 block font-semibold text-slate-800">{value}</span>
      <span className="mt-0.5 block text-[10px] text-slate-400">{label}</span>
    </div>
  )

  const download = async () => {
    setDownloading(true)
    setError('')
    try {
      await downloadTravelBrief(request, trip)
    } catch (e) {
      setError(e.message || 'Brief unavailable')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <aside className="w-full animate-fade-up rounded-[22px] border border-white/70 bg-white/82 p-5 shadow-[0_20px_60px_rgba(15,23,42,.14)] backdrop-blur-2xl">
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#6C63FF] text-white shadow-lg shadow-[#6C63FF]/25">
            <Sparkles size={18} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#6C63FF]">AI travel summary</p>
            <h2 className="mt-1 text-lg font-extrabold tracking-tight text-slate-950">Your trip, intelligently mapped</h2>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand trip summary' : 'Collapse trip summary'}
          >
            {collapsed ? <ChevronDown size={16} /> : <Minus size={16} />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close trip summary"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          <p className="mt-4 text-sm leading-5 text-slate-600">
            {trip.summary || 'A balanced route with the best available stays, places and crowd signals.'}
          </p>

          {/* An empty section has a reason; say it rather than showing a
              silent zero the traveller has to guess about. */}
          {dataIssues.length > 0 && (
            <ul className="mt-3 space-y-1 rounded-xl bg-amber-50 p-3">
              {dataIssues.map((issue) => (
                <li key={issue} className="flex items-start gap-1.5 text-[11px] leading-4 text-amber-900">
                  <Info size={12} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
                  {issue}
                </li>
              ))}
            </ul>
          )}

          {destination && <TripExperiencePanel destination={destination} stays={stays} itineraryDays={itineraryDays} />}

          {stays.length > 0 && (
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {stays.slice(0, 3).map((stay) => (
                <div key={`${stay.name}-${stay.photoUrl || ''}`} className="min-w-[128px] overflow-hidden rounded-xl border border-slate-200/80 bg-white/70">
                  <div className="h-16 bg-slate-100">
                    {photoUrl(stay.photoUrl)
                      ? <img src={photoUrl(stay.photoUrl)} alt={stay.name} className="h-full w-full object-cover" loading="lazy" />
                      : <div className="flex h-full items-center justify-center text-[10px] font-bold text-slate-400">No photo</div>}
                  </div>
                  <p className="truncate px-2 py-2 text-[11px] font-bold text-slate-700">{stay.name}</p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 grid grid-cols-3 gap-2">
            {metric(Route, trip.route?.distanceKm != null ? `${trip.route.distanceKm} km` : 'Unavailable', 'distance')}
            {metric(Hotel, stays.length ? `${stays.length} stays` : 'Unavailable', stays.length ? 'shortlisted' : 'no listings', stays.length ? 'text-[#6C63FF]' : 'text-slate-400')}
            {metric(CalendarDays, `${itineraryDays.length} days`, 'itinerary')}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {metric(ThermometerSun, weatherValue, weatherLabel, 'text-amber-500')}
            {metric(WalletCards, budgetValue, 'estimated', 'text-emerald-600')}
            {metric(Gauge, scorePercent(trip.pressure?.score) != null ? `${scorePercent(trip.pressure?.score)}%` : 'Unavailable', 'pressure', 'text-emerald-600')}
          </div>

          {trip.travel_tips && (
            <p className="mt-3 rounded-xl bg-[#6C63FF]/8 p-3 text-[11px] leading-5 text-slate-700">{trip.travel_tips}</p>
          )}

          {/* Previously this button dispatched a `sahyatri:view-itinerary`
              CustomEvent that nothing in the app listened for, so it did
              nothing at all. The itinerary is right here, so it opens here. */}
          {showItinerary && (
            <div className="mt-4 max-h-60 space-y-3 overflow-y-auto rounded-xl border border-slate-200/80 bg-white/70 p-3">
              {itineraryDays.length === 0 && (
                <p className="text-[11px] text-slate-500">No stops were available for this trip.</p>
              )}
              {itineraryDays.map((day, index) => (
                <div key={day?.day ?? index}>
                  <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#6C63FF]">Day {day?.day ?? index + 1}</p>
                  <ul className="mt-1.5 space-y-1.5">
                    {(day?.stops || []).map((stop, stopIndex) => (
                      <li key={`${itineraryStopName(stop)}-${stopIndex}`} className="flex items-center gap-2">
                        {photoUrl(stop?.photoUrl)
                          ? <img src={photoUrl(stop.photoUrl)} alt="" className="h-8 w-8 shrink-0 rounded-md object-cover" loading="lazy" />
                          : <span className="h-8 w-8 shrink-0 rounded-md bg-slate-100" aria-hidden="true" />}
                        <span className="w-14 shrink-0 text-[10px] font-bold text-slate-400">{stopTime(stop)}</span>
                        <span className="truncate text-[11px] text-slate-700">{itineraryStopName(stop)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {error && <p className="mt-2 text-xs font-semibold text-rose-600">{error}</p>}

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setShowItinerary((value) => !value)}
              aria-expanded={showItinerary}
              className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white/70 px-3 py-2.5 text-xs font-bold text-slate-700 transition hover:-translate-y-0.5"
            >
              <span>{showItinerary ? 'Hide itinerary' : 'View itinerary'}</span>
              <ChevronDown size={14} className={showItinerary ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </button>
            <button
              type="button"
              onClick={download}
              disabled={downloading}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 py-2.5 text-xs font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#6C63FF] disabled:opacity-60"
            >
              {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {downloading ? 'Generating…' : 'Download AI brief'}
            </button>
          </div>
        </>
      )}
    </aside>
  )
}
