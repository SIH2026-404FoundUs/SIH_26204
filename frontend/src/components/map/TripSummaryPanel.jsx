import { CalendarDays, CheckCircle2, Download, Hotel, Loader2, Route, Sparkles, ThermometerSun, WalletCards, X } from 'lucide-react'
import { useState } from 'react'
import { usePlannerStore } from '../../store/usePlannerStore'
import { downloadTravelBrief } from '../../lib/travelBrief'

export default function TripSummaryPanel({ plan, onClose }) {
  const request = usePlannerStore((state) => state.request)
  const [downloading, setDownloading] = useState(false)
  const [briefError, setBriefError] = useState('')

  if (!plan?.trip) return null
  const trip = plan.trip
  const days = trip.itinerary?.days || []

  const downloadBrief = async () => {
    if (downloading) return
    setDownloading(true)
    setBriefError('')
    try {
      await downloadTravelBrief(request, trip)
    } catch (error) {
      setBriefError(error.message || 'Travel brief is temporarily unavailable')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <aside className="absolute bottom-4 left-4 z-30 w-[min(430px,calc(100%-2rem))] animate-in slide-in-from-bottom-3 fade-in rounded-[20px] border border-white/50 bg-white/80 p-4 shadow-[0_20px_60px_rgba(0,0,0,.08)] backdrop-blur-2xl duration-300">
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#6C63FF] text-white shadow-sm"><Sparkles size={17} /></div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#6C63FF]">AI travel summary</p>
            <h2 className="mt-1 text-base font-extrabold text-slate-900">Your map plan is ready</h2>
          </div>
        </div>
        <button type="button" onClick={onClose} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close trip summary"><X size={16} /></button>
      </div>
      <p className="mt-3 text-sm leading-5 text-slate-600">{trip.summary}</p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-lg bg-slate-50 p-2"><Route size={14} className="text-indigo-600" /><span className="mt-1 block font-semibold text-slate-700">{trip.route?.distanceKm != null ? `${trip.route.distanceKm} km` : 'Route ready'}</span></div>
        <div className="rounded-lg bg-slate-50 p-2"><Hotel size={14} className="text-indigo-600" /><span className="mt-1 block font-semibold text-slate-700">{trip.hotels?.length || 0} hotels</span></div>
        <div className="rounded-lg bg-slate-50 p-2"><CalendarDays size={14} className="text-indigo-600" /><span className="mt-1 block font-semibold text-slate-700">{days.length || 0} days</span></div>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-lg bg-slate-50 p-2"><ThermometerSun size={14} className="text-amber-500" /><span className="mt-1 block font-semibold text-slate-700">{trip.weather?.maxTemp != null ? `${trip.weather.maxTemp}°` : 'Weather ready'}</span></div>
        <div className="rounded-lg bg-slate-50 p-2"><WalletCards size={14} className="text-emerald-600" /><span className="mt-1 block font-semibold text-slate-700">{trip.costBreakdown?.grandTotal ? `₹${Number(trip.costBreakdown.grandTotal).toLocaleString('en-IN')}` : 'Budget checked'}</span></div>
        <div className="rounded-lg bg-slate-50 p-2"><CheckCircle2 size={14} className="text-emerald-600" /><span className="mt-1 block font-semibold text-slate-700">{trip.pressure?.score != null ? `${Math.round((1 - trip.pressure.score) * 100)}% score` : 'Verified data'}</span></div>
      </div>
      {plan.redistribution?.kind && plan.redistribution.kind !== 'none' && <p className="mt-3 rounded-lg bg-emerald-50 p-2 text-xs font-semibold text-emerald-700">Plan switched to a lower-pressure {plan.redistribution.kind === 'place' ? 'destination' : 'date'}.</p>}
      {briefError && <p className="mt-2 text-xs font-semibold text-rose-600">{briefError}</p>}
      <button type="button" onClick={downloadBrief} disabled={downloading} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-60">
        {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
        {downloading ? 'Generating travel brief...' : 'Download AI travel brief'}
      </button>
    </aside>
  )
}
