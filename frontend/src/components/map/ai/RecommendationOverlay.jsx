import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Check, CloudSun, Eye, MapPin, RefreshCw, Route, ShieldCheck, X } from 'lucide-react'
import api, { aiApi } from '../../../lib/api'
import { useDestinationsStore } from '../../../store/useDestinationsStore'
import { usePlannerStore } from '../../../store/usePlannerStore'

function unwrap(response) {
  return response?.data?.data ?? response?.data ?? null
}

function destinationName(destination, fallback) {
  return destination?.displayName || destination?.name || destination?._id || fallback
}

function formatDate(value) {
  if (!value) return ''
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function metricValue(value, suffix = '') {
  return value == null ? 'Unavailable' : `${value}${suffix}`
}

function hotelCount(snapshot) {
  return Array.isArray(snapshot?.hotels) ? snapshot.hotels.length : 0
}

/**
 * Pressure decision overlay with an explicit preview transaction.
 * Loading a preview only fetches comparison data and highlights the suggested
 * destination. The planner store changes only by Accept -> submitDecision.
 */
export default function RecommendationOverlay({ onHighlight, onPreviewRoute, swapOffers = null, onApplySwap, onClosePreview }) {
  const { destinations } = useDestinationsStore()
  const { request, pressure, alternatives, awaitingDecision, submitDecision, isPlanning, error } = usePlannerStore()
  const previewMode = Boolean(swapOffers && !awaitingDecision)
  const [preview, setPreview] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [aiInsight, setAiInsight] = useState(null)
  const [activeAlternativeKind, setActiveAlternativeKind] = useState('place')

  const currentDestId = alternatives?.requested?.destId || request?.destId
  const currentDestination = destinations.find((item) => (item._id || item.id) === currentDestId)
  const suggestedPlace = previewMode
    ? swapOffers?.destination_swap?.candidate
    : alternatives?.places?.[0]
  const suggestedDate = previewMode
    ? swapOffers?.date_swap?.candidate
    : alternatives?.dates?.[0]
  const hasPlaceAlternative = Boolean(suggestedPlace)
  const hasDateAlternative = Boolean(suggestedDate)
  const activeKind = activeAlternativeKind === 'place' && !hasPlaceAlternative ? 'date' : activeAlternativeKind
  const suggestion = activeKind === 'date' ? suggestedDate : suggestedPlace || suggestedDate
  const suggestionDestId = activeKind === 'date' ? currentDestId : suggestedPlace?.destId || currentDestId
  const suggestedDestination = destinations.find((item) => (item._id || item.id) === suggestionDestId)
  const selectedAlternative = previewMode
    ? {
        destId: swapOffers?.destination_swap?.alternative_destination,
        startDate: swapOffers?.date_swap?.alternative_dates?.[0],
      }
    : activeKind === 'place' && suggestedPlace
      ? { destId: suggestedPlace.destId }
      : activeKind === 'date' && suggestedDate
        ? { date: suggestedDate.startDate }
        : null

  const currentName = destinationName(currentDestination, currentDestId)
  const suggestedName = activeKind === 'place' && suggestedPlace
    ? (suggestedPlace.displayName || suggestedPlace.destId)
    : activeKind === 'date' && suggestedDate
      ? `${currentName} - ${formatDate(suggestedDate.startDate)}`
      : 'No alternative found'

  const reason = useMemo(() => {
    if (!suggestion) return 'The current trip has a pressure signal, but no verified lower-pressure alternative was found.'
    if (activeKind === 'place' && suggestedPlace) return `${suggestedName} matches your trip profile while reducing destination pressure.`
    return `The same destination is quieter on ${formatDate(suggestedDate.startDate)} and keeps your route familiar.`
  }, [suggestion, suggestedPlace, suggestedDate, suggestedName, activeKind])

  useEffect(() => {
    if (!awaitingDecision || !request) return undefined
    let active = true
    aiApi.post('/internal/ai/recommendation', { trip: request, pressure, alternatives, interests: request.interests || {} })
      .then(({ data }) => { if (active && data) setAiInsight(data) })
      .catch(() => {})
    return () => { active = false }
  }, [awaitingDecision, request, pressure, alternatives])

  useEffect(() => {
    setActiveAlternativeKind(suggestedPlace ? 'place' : 'date')
  }, [suggestedPlace, suggestedDate])

  useEffect(() => () => { onPreviewRoute?.(null) }, [onPreviewRoute])

  if (!awaitingDecision && !previewMode) return null

  const currentLocation = currentDestination?.location
  const alternativeLocation = suggestedDestination?.location || currentLocation
  const previewDate = suggestedDate?.startDate || request?.startDate

  const loadPreview = async () => {
    if (!suggestion || previewLoading || !alternativeLocation?.lat || !alternativeLocation?.lng) return
    setPreviewLoading(true)
    setPreview(null)
    onHighlight?.(suggestionDestId)
    try {
      const currentRequests = currentLocation?.lat && currentLocation?.lng
        ? [
            api.get(`/v1/pressure/${currentDestId}`, { params: { date: request?.startDate } }),
            api.get('/weather', { params: { lat: currentLocation.lat, lng: currentLocation.lng, date: request?.startDate } }),
            api.get('/places', { params: { query: `hotels in ${currentName}`, lat: currentLocation.lat, lng: currentLocation.lng, radiusMeters: 20000 } }),
          ]
        : [Promise.resolve({ data: pressure }), Promise.resolve({ data: null }), Promise.resolve({ data: [] })]
      const alternativeRequests = [
        api.get(`/v1/pressure/${suggestionDestId}`, { params: { date: previewDate } }),
        api.get('/weather', { params: { lat: alternativeLocation.lat, lng: alternativeLocation.lng, date: previewDate } }),
        api.get('/places', { params: { query: `hotels in ${suggestedName}`, lat: alternativeLocation.lat, lng: alternativeLocation.lng, radiusMeters: 20000 } }),
      ]
      const [[currentPressure, currentWeather, currentHotels], [alternativePressure, alternativeWeather, alternativeHotels]] = await Promise.all([
        Promise.all(currentRequests), Promise.all(alternativeRequests),
      ])

      const originResponse = await api.get('/geocode', { params: { address: request?.origin } })
      const origin = unwrap(originResponse)
      let route = null
      if (origin?.lat != null && origin?.lng != null) {
        const routeResponse = await api.post('/routes', {
          originLat: origin.lat, originLng: origin.lng,
          destLat: alternativeLocation.lat, destLng: alternativeLocation.lng, mode: 'DRIVE',
        })
        route = unwrap(routeResponse)
      }

      setPreview({
        current: {
          name: currentName,
          pressure: unwrap(currentPressure) || currentPressure,
          weather: unwrap(currentWeather),
          hotels: unwrap(currentHotels) || [],
          budget: alternatives?.requested?.totalCost ?? request?.budgetINR,
        },
        alternative: {
          name: suggestedName,
          pressure: unwrap(alternativePressure),
          weather: unwrap(alternativeWeather),
          hotels: unwrap(alternativeHotels) || [],
          budget: suggestion?.totalCost ?? (request?.budgetINR != null && suggestion?.savingINR != null ? request.budgetINR - suggestion.savingINR : null),
        },
        route,
      })
      if (route) {
        onPreviewRoute?.({
          ...route,
          originCoords: { lat: origin.lat, lng: origin.lng },
          destCoords: { lat: alternativeLocation.lat, lng: alternativeLocation.lng },
          sourceName: request?.origin || 'Origin', destName: suggestedName,
          travelMode: 'DRIVE', variant: 'preview',
        })
      }
    } catch (previewError) {
      setPreview({ error: previewError?.response?.data?.message || previewError.message || 'Preview data unavailable' })
    } finally {
      setPreviewLoading(false)
    }
  }

  const cancelPreview = () => {
    setPreview(null)
    onPreviewRoute?.(null)
    onHighlight?.(currentDestId)
    if (previewMode) onClosePreview?.()
  }

  const acceptPreview = () => {
    if (!selectedAlternative || !preview || preview.error) return
    if (previewMode) {
      onApplySwap?.(swapOffers)
    } else {
      submitDecision('accept', selectedAlternative)
    }
  }

  return (
    <aside className="w-full animate-slide-right overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-2xl backdrop-blur-md">
      <div className="bg-slate-950 px-4 py-3 text-white">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">Tourism command center</p><h2 className="mt-1 text-base font-extrabold">A lower-pressure option is available</h2></div>
          <button type="button" onClick={() => (previewMode ? onClosePreview?.() : submitDecision('decline'))} disabled={isPlanning} className="rounded-full p-1 text-white/60 hover:bg-white/10 hover:text-white" aria-label={previewMode ? 'Close preview' : 'Stay with current trip'}><X size={16} /></button>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase text-slate-400">Current</p><p className="mt-1 truncate text-sm font-bold text-slate-800">{currentName}</p><p className="mt-1 flex items-center gap-1 text-xs text-rose-600"><ShieldCheck size={13} /> {Math.round((pressure?.score || 0) * 100)}% pressure</p></div>
          <div className="rounded-xl bg-emerald-50 p-3"><p className="text-[10px] font-bold uppercase text-emerald-600">Recommended</p><p className="mt-1 truncate text-sm font-bold text-slate-800">{suggestedName}</p>{suggestion && <p className="mt-1 flex items-center gap-1 text-xs text-emerald-700"><ArrowRight size={13} /> {suggestion.savingINR ? `Save Rs ${suggestion.savingINR.toLocaleString('en-IN')}` : 'Lower pressure'}</p>}</div>
        </div>

        {!previewMode && hasPlaceAlternative && hasDateAlternative && <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-1"><button type="button" onClick={() => setActiveAlternativeKind('place')} className={`rounded-lg px-2 py-2 text-[11px] font-bold transition ${activeKind === 'place' ? 'bg-white text-[#6C63FF] shadow-sm' : 'text-slate-500'}`}>Quieter destination</button><button type="button" onClick={() => setActiveAlternativeKind('date')} className={`rounded-lg px-2 py-2 text-[11px] font-bold transition ${activeKind === 'date' ? 'bg-white text-[#6C63FF] shadow-sm' : 'text-slate-500'}`}>Quieter dates</button></div>}

        {(aiInsight?.reasons?.length > 0 || (previewMode && (swapOffers?.destination_swap?.reason?.length || swapOffers?.date_swap?.reason?.length))) && <ul className="space-y-1 rounded-xl bg-emerald-50/70 p-3">{(previewMode ? [...(swapOffers?.destination_swap?.reason || []), ...(swapOffers?.date_swap?.reason || [])] : aiInsight.reasons).filter((item, index, items) => items.indexOf(item) === index).map((item) => <li key={item} className="flex items-start gap-1.5 text-xs leading-5 text-emerald-900"><Check size={13} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />{item}</li>)}</ul>}
        <p className="text-xs leading-5 text-slate-600">{aiInsight?.reason || reason}</p>
        {aiInsight?.explanation && <p className="rounded-lg bg-amber-50 p-2 text-xs leading-5 text-amber-900">{aiInsight.explanation}</p>}
        {aiInsight?.advice?.length > 0 && <ul className="list-disc space-y-1 pl-4 text-[11px] text-slate-600">{aiInsight.advice.map((tip) => <li key={tip}>{tip}</li>)}</ul>}

        {preview && <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-3">
          <div className="flex items-center justify-between"><div><p className="text-xs font-extrabold text-indigo-950">Compare before switching</p><p className="text-[10px] text-indigo-700">Your current trip is unchanged until Accept.</p></div><button type="button" onClick={cancelPreview} className="text-indigo-500" aria-label="Cancel preview"><X size={14} /></button></div>
          {preview.error ? <p className="mt-2 text-xs text-rose-600">{preview.error}</p> : <div className="mt-3 grid grid-cols-2 gap-2">
            {[['Current trip', preview.current], ['Alternative', preview.alternative]].map(([label, snapshot]) => <div key={label} className="rounded-xl border border-white/80 bg-white/80 p-2 text-[11px] text-slate-700"><p className="font-extrabold text-slate-900">{label}</p><p className="mt-1 truncate font-semibold">{snapshot.name}</p><p className="mt-2 flex items-center gap-1"><ShieldCheck size={12} /> Pressure: {metricValue(snapshot.pressure?.score != null ? `${Math.round(snapshot.pressure.score * 100)}%` : null)}</p><p className="mt-1 flex items-center gap-1"><CloudSun size={12} /> Weather: {metricValue(snapshot.weather?.maxTemp, '°')}</p><p className="mt-1 flex items-center gap-1"><MapPin size={12} /> Hotels: {hotelCount(snapshot)}</p><p className="mt-1 flex items-center gap-1"><Route size={12} /> Estimate: {snapshot.budget == null ? 'Unavailable' : `Rs ${Number(snapshot.budget).toLocaleString('en-IN')}`}</p></div>)}
            <div className="col-span-2 rounded-lg bg-white/80 px-2 py-1.5 text-[11px] font-semibold text-indigo-900">{suggestion?.savingINR != null ? `Phase 2 estimate: Rs ${Math.abs(suggestion.savingINR).toLocaleString('en-IN')} ${suggestion.savingINR >= 0 ? 'saving' : 'additional cost'}.` : 'Phase 2 recommendation reasoning is shown above.'}</div>
          </div>}
        </div>}

        {error && <p className="rounded-lg bg-rose-50 p-2 text-xs font-semibold text-rose-700">{error}</p>}
        {!preview ? <button type="button" onClick={loadPreview} disabled={!suggestion || previewLoading} className="flex w-full items-center justify-center gap-1 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-xs font-bold text-indigo-700 disabled:opacity-50">{previewLoading ? <RefreshCw size={13} className="animate-spin" /> : <Eye size={13} />} {previewLoading ? 'Loading comparison...' : 'Preview alternative'}</button> : <div className="grid grid-cols-2 gap-2"><button type="button" onClick={cancelPreview} disabled={isPlanning} className="flex items-center justify-center gap-1 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-700 disabled:opacity-50"><X size={13} /> Cancel</button><button type="button" onClick={acceptPreview} disabled={!selectedAlternative || preview.error || isPlanning} className="flex items-center justify-center gap-1 rounded-xl bg-indigo-600 px-3 py-2.5 text-xs font-bold text-white disabled:bg-slate-300"><Check size={13} /> {isPlanning ? 'Applying...' : 'Apply swap'}</button></div>}
      </div>
    </aside>
  )
}
