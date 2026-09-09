import { useEffect, useMemo, useState } from 'react'
import { ArrowUpDown, CalendarDays, CheckCircle2, ChevronDown, CircleDollarSign, Compass, Download, Hotel, MapPin, Route as RouteIcon, Search, SlidersHorizontal, Users, WalletCards } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../../store/useAuthStore'
import { useTripsStore } from '../../store/useTripsStore'
import { getDestinationLabel } from '../../lib/destinations'
import { redistributionKindLabel, tripStateLabel } from '../../lib/labels'
import { downloadTravelBrief } from '../../lib/travelBrief'
import PageHeader from '../ui/PageHeader'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Alert from '../ui/Alert'
import LoadingState from '../ui/LoadingState'
import EmptyState from '../ui/EmptyState'

function formatMoney(value) {
  return value == null ? null : `₹${Number(value).toLocaleString('en-IN')}`
}

function tripDates(trip) {
  return trip.finalDates?.startDate ? trip.finalDates : trip.requestedDates
}

function displayDate(value) {
  if (!value) return 'Date not set'
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function stopName(stop) {
  return stop?.name || stop?.location?.name || stop?.activity || 'Planned stop'
}

function SavedTripDetails({ trip, onDownload, downloading }) {
  const days = Array.isArray(trip.itinerary?.days) ? trip.itinerary.days : []
  const selectedHotel = trip.selectedHotel
  const route = trip.transport
  const total = trip.costBreakdown?.grandTotal ?? trip.costBreakdown?.totalCost

  return (
    <div className="mt-4 border-t border-paper-dim pt-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl bg-paper p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-ash">Travellers</p><p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-ink"><Users size={14} /> {trip.travellers || '—'}</p></div>
        <div className="rounded-xl bg-paper p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-ash">Budget</p><p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-ink"><WalletCards size={14} /> {formatMoney(total || trip.budgetINR) || '—'}</p></div>
        <div className="rounded-xl bg-paper p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-ash">Route</p><p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-ink"><RouteIcon size={14} /> {route?.distanceKm != null ? `${route.distanceKm} km` : '—'}{route?.durationMinutes != null ? ` · ${route.durationMinutes} min` : ''}</p></div>
      </div>

      {selectedHotel?.name && <div className="mt-3 flex items-start gap-2 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-sm text-indigo-950"><Hotel size={16} className="mt-0.5 shrink-0 text-indigo-600" /><div><p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Selected stay</p><p className="font-bold">{selectedHotel.name}</p>{selectedHotel.rating != null && <p className="text-xs text-indigo-700">Rating {selectedHotel.rating}</p>}</div></div>}

      {days.length > 0 ? <div className="mt-4 space-y-3"><h3 className="flex items-center gap-2 text-sm font-bold text-ink"><CalendarDays size={16} className="text-pressure" /> Itinerary</h3>{days.map((day, index) => <div key={day.day || index} className="rounded-xl border border-paper-dim p-3"><p className="text-xs font-extrabold uppercase tracking-wider text-pressure">Day {day.day || index + 1}</p><div className="mt-2 space-y-2">{(day.stops || []).map((stop, stopIndex) => <div key={`${stopName(stop)}-${stopIndex}`} className="flex items-start gap-2 text-sm text-ink"><MapPin size={14} className="mt-1 shrink-0 text-relief" /><div><p className="font-semibold">{stopName(stop)}</p><p className="text-xs text-ash">{stop.startTime || stop.time || 'Scheduled stop'}{stop.endTime ? ` – ${stop.endTime}` : ''}{stop.activity ? ` · ${stop.activity}` : ''}</p></div></div>)}{(!day.stops || day.stops.length === 0) && <p className="text-xs text-ash">No stops were saved for this day.</p>}</div></div>)}</div> : <p className="mt-4 text-xs text-ash">Detailed itinerary was not saved for this trip.</p>}

      {trip.origin && <p className="mt-4 text-xs text-ash">Starting from <span className="font-semibold text-ink">{trip.origin}</span></p>}
      {trip.itinerary && <Button variant="secondary" className="mt-4" onClick={onDownload} loading={downloading} icon={Download}>Download travel brief</Button>}
    </div>
  )
}

export default function MyTrips() {
  const authUser = useAuthStore((state) => state.authUser)
  const { trips, isLoading, error, fetchMyTrips } = useTripsStore()
  const [expandedId, setExpandedId] = useState(null)
  const [query, setQuery] = useState('')
  const [downloadingId, setDownloadingId] = useState(null)
  const [filter, setFilter] = useState('all')
  const [sortNewest, setSortNewest] = useState(true)

  useEffect(() => {
    if (authUser) fetchMyTrips()
  }, [authUser, fetchMyTrips])

  const stats = useMemo(() => ({
    total: trips.length,
    redirected: trips.filter((trip) => trip.redistribution?.kind && trip.redistribution.kind !== 'none').length,
    savings: trips.reduce((sum, trip) => sum + Number(trip.redistribution?.savingINR || 0), 0),
    planned: trips.filter((trip) => trip.state === 'planned' || trip.state === 'confirmed').length,
  }), [trips])

  const visibleTrips = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const filtered = trips.filter((trip) => {
      if (filter === 'redirected' && (!trip.redistribution?.kind || trip.redistribution.kind === 'none')) return false
      if (filter === 'planned' && !['planned', 'confirmed'].includes(trip.state)) return false
      if (filter === 'draft' && trip.state !== 'draft') return false
      const destination = getDestinationLabel(trip.redirectedToDestId || trip.requestedDestId)
      return !needle || `${destination} ${trip.origin || ''}`.toLowerCase().includes(needle)
    })
    return [...filtered].sort((left, right) => {
      const leftDate = new Date(left.createdAt || 0).getTime()
      const rightDate = new Date(right.createdAt || 0).getTime()
      return sortNewest ? rightDate - leftDate : leftDate - rightDate
    })
  }, [trips, query, filter, sortNewest])

  const handleDownload = async (trip) => {
    setDownloadingId(trip._id)
    const dates = tripDates(trip) || {}
    const request = { origin: trip.origin, destId: trip.redirectedToDestId || trip.requestedDestId, startDate: dates.startDate, endDate: dates.endDate, travellers: trip.travellers, budgetINR: trip.budgetINR, interests: trip.interests || {} }
    const summary = { summary: `Saved trip to ${getDestinationLabel(request.destId)}`, itinerary: trip.itinerary, route: trip.transport, costBreakdown: trip.costBreakdown, hotels: trip.selectedHotel ? [trip.selectedHotel] : [] }
    try {
      await downloadTravelBrief(request, summary)
    } catch (downloadError) {
      window.alert(downloadError.message || 'Travel brief is temporarily unavailable')
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div className="pb-8">
      <PageHeader icon={RouteIcon} title="My trips" description="Your travel history, saved itineraries, and the choices that helped spread demand." />
      {error && <div className="mb-4"><Alert tone="error">{error}</Alert></div>}
      {isLoading ? <LoadingState label="Loading your trips…" /> : trips.length === 0 ? <EmptyState icon={RouteIcon} title="No trips yet" description="Plan a trip and it'll show up here, including whether it was redirected to relieve crowding." action={<Link to="/home"><Button variant="primary">Plan a trip</Button></Link>} /> : <>
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[[Compass, 'Total trips', stats.total, 'Your saved planning history'], [CheckCircle2, 'Planned', stats.planned, 'Ready-to-use trip plans'], [CircleDollarSign, 'Savings', formatMoney(stats.savings) || '₹0', 'From pressure-aware swaps'], [RouteIcon, 'Redistributed', stats.redirected, 'Trips that eased pressure']].map(([Icon, label, value, helper]) => <div key={label} className="rounded-2xl border border-paper-dim bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-ash">{label}</span><Icon size={17} className="text-pressure" /></div><p className="mt-2 font-display text-2xl text-ink">{value}</p><p className="mt-1 text-xs text-ash">{helper}</p></div>)}
        </div>
        <div className="mb-4 rounded-2xl border border-paper-dim bg-white p-3 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label className="relative min-w-0 flex-1"><Search size={16} className="absolute left-3 top-3.5 text-ash" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search destination or starting point" aria-label="Search trips" className="w-full rounded-xl border border-paper-dim bg-paper py-3 pl-9 pr-3 text-sm text-ink outline-none focus:border-pressure focus:ring-4 focus:ring-pressure/10" /></label>
            <div className="flex items-center gap-2 overflow-x-auto"><SlidersHorizontal size={15} className="shrink-0 text-ash" />{[['all', 'All'], ['planned', 'Planned'], ['redirected', 'Redistributed'], ['draft', 'Drafts']].map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold transition ${filter === value ? 'bg-ink text-paper' : 'bg-paper text-ash hover:bg-paper-dim'}`}>{label}</button>)}</div>
            <button type="button" onClick={() => setSortNewest((value) => !value)} className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-paper-dim px-3 py-2 text-xs font-bold text-ink hover:bg-paper"><ArrowUpDown size={14} /> {sortNewest ? 'Newest first' : 'Oldest first'}</button>
          </div>
          <p className="mt-2 text-[11px] text-ash">Showing {visibleTrips.length} of {trips.length} trips</p>
        </div>
        {visibleTrips.length === 0 ? <EmptyState icon={RouteIcon} title="No matching trips" description="Try a different filter, destination, or starting point." /> : <div className="space-y-3">{visibleTrips.map((trip) => {
          const redist = redistributionKindLabel(trip.redistribution?.kind)
          const state = tripStateLabel(trip.state)
          const dates = tripDates(trip)
          const destId = trip.redirectedToDestId || trip.requestedDestId
          const expanded = expandedId === trip._id
          const hasItinerary = Boolean(trip.itinerary?.days?.length)
          return <Card key={trip._id} className={`overflow-hidden transition-shadow ${expanded ? 'shadow-md ring-1 ring-pressure/10' : 'hover:shadow-md'}`}>
            <button type="button" className="w-full text-left" onClick={() => setExpandedId(expanded ? null : trip._id)} aria-expanded={expanded}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="flex items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ink text-paper"><Compass size={21} /></div><div><p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-pressure">{trip.origin ? `${trip.origin} →` : 'Saved journey'}</p><h2 className="mt-1 font-display text-xl text-ink">{getDestinationLabel(destId)}</h2><p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ash"><span className="inline-flex items-center gap-1"><CalendarDays size={13} /> {dates?.startDate ? `${displayDate(dates.startDate)}${dates.endDate ? ` – ${displayDate(dates.endDate)}` : ''}` : 'Dates not set'}</span>{trip.travellers != null && <span>· {trip.travellers} traveller{trip.travellers === 1 ? '' : 's'}</span>}</p></div></div><div className="flex items-center gap-1.5 sm:pt-1"><Badge tone={state.tone}>{state.label}</Badge><Badge tone={redist.tone}>{redist.label}</Badge><ChevronDown size={17} className={`ml-1 text-ash transition-transform ${expanded ? 'rotate-180' : ''}`} /></div></div>
              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-paper-dim pt-3 text-xs sm:grid-cols-4"><span><span className="block text-ash">Budget</span><strong className="mt-1 block text-ink">{formatMoney(trip.costBreakdown?.grandTotal || trip.budgetINR) || '—'}</strong></span><span><span className="block text-ash">Route</span><strong className="mt-1 block text-ink">{trip.transport?.distanceKm != null ? `${trip.transport.distanceKm} km` : '—'}</strong></span><span><span className="block text-ash">Itinerary</span><strong className="mt-1 block text-ink">{hasItinerary ? `${trip.itinerary.days.length} days` : 'Not saved'}</strong></span><span><span className="block text-ash">Savings</span><strong className="mt-1 block text-relief">{formatMoney(trip.redistribution?.savingINR) || '—'}</strong></span></div>
            </button>
            {expanded && <SavedTripDetails trip={trip} onDownload={() => handleDownload(trip)} downloading={downloadingId === trip._id} />}
          </Card>
        })}</div>}
      </>}
    </div>
  )
}
