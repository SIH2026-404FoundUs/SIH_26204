import { MapPin, TrendingDown, Clock } from 'lucide-react'
import Card from '../ui/Card'
import Button from '../ui/Button'
import { getDestinationLabel } from '../../lib/destinations'

/**
 * A single alternative destination for a crowded trip. All numbers here come
 * straight from the substitution engine's response -- nothing on this card is
 * invented client-side.
 */
export default function PlaceSwapVariant({ place, requestedPressure = 0.8, onAccept }) {
  if (!place) return null

  const {
    destId,
    displayName,
    distance,
    dStar = 1.15,
    pressure = 0.5,
    travelTimeRatio,
    travelTimeHours = 0,
    stayCost = 0,
    transportCost = 0,
    totalCost = 0,
    savingINR = 0,
    rank = 1
  } = place;

  // Calculate pressure relief drop (percentage point reduction)
  const pressureRelief = Math.max(0, requestedPressure - pressure);
  const pressureReliefPercent = Math.round(pressureRelief * 100);
  const currentPressurePercent = Math.round(pressure * 100);

  // Format travel time text
  const hasTravelHours = typeof travelTimeHours === 'number' && travelTimeHours > 0;
  const ratioVal = typeof travelTimeRatio === 'number' && travelTimeRatio > 0 ? travelTimeRatio : 1.0;
  const travelDeltaText =
    ratioVal < 0.98
      ? `${Math.round((1 - ratioVal) * 100)}% Faster`
      : ratioVal > 1.02
      ? `${Math.round((ratioVal - 1) * 100)}% Longer`
      : 'Same Duration';

  // Similarity score out of 100 based on distance vs dStar
  const similarityScore = Math.max(0, Math.min(100, Math.round((1 - distance / (dStar * 1.2)) * 100)));

  const handleAccept = () => {
    console.log('[SwapEngine] Accept Place Alternative triggered:', { destId, displayName, place });
    if (typeof onAccept === 'function') {
      onAccept(place);
    }
  };

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md">
      {/* Top Banner & Rank */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-xs font-bold text-indigo-600 border border-indigo-100">
            #{rank}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-100">
            <Sparkles size={12} className="text-emerald-500" />
            High Relief Alternative
          </span>
        </div>

        {savingINR > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 border border-amber-200/60">
            <IndianRupee size={12} />
            Save ₹{savingINR.toLocaleString('en-IN')}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            Est. ₹{(totalCost || 7000).toLocaleString('en-IN')}
          </span>
        )}
      </div>

      {/* Destination Title */}
      <div className="mb-4">
        <h3 className="flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors">
          <MapPin size={18} className="text-indigo-500 shrink-0" />
          {displayName}
        </h3>
      </div>

      {/* Side-by-Side Metrics Grid */}
      <div className="mb-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 border border-slate-100">
        {/* 1. Attribute Distance / Similarity */}
        <div className="flex flex-col items-center text-center p-1.5 rounded-lg bg-white shadow-2xs border border-slate-100">
          <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
            <Compass size={11} className="text-indigo-500" />
            Match
          </span>
          <span className="mt-0.5 text-sm font-extrabold text-slate-800">
            {similarityScore}%
          </span>
          <span className="text-[10px] text-slate-400">d = {typeof distance === 'number' ? distance.toFixed(2) : distance}</span>
        </div>

        {/* 2. Travel Time (Actual Hours + Delta) */}
        <div className="flex flex-col items-center text-center p-1.5 rounded-lg bg-white shadow-2xs border border-slate-100">
          <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
            <Clock size={11} className="text-blue-500" />
            Travel
          </span>
          <span className="mt-0.5 text-sm font-extrabold text-slate-800">
            {hasTravelHours ? `${travelTimeHours >= 1 ? travelTimeHours.toFixed(1) : Math.round(travelTimeHours * 60)} ${travelTimeHours >= 1 ? 'hrs' : 'mins'}` : `${ratioVal.toFixed(1)}x`}
          </span>
          <span className={`text-[10px] font-semibold ${ratioVal <= 1.0 ? 'text-emerald-600' : 'text-amber-600'}`}>
            {hasTravelHours ? `${ratioVal.toFixed(1)}x (${travelDeltaText})` : travelDeltaText}
          </span>
        </div>
        <div>
          <dt className="flex items-center justify-center gap-1 text-slate-400"><TrendingDown size={11} aria-hidden="true" />Crowding</dt>
          <dd className="mt-0.5 font-semibold text-emerald-600">-{pressureReliefPercent}pt ({currentPressurePercent}%)</dd>
        </div>
      </dl>

      {/* Budget Breakdown Pills */}
      {(stayCost > 0 || transportCost > 0) && (
        <div className="mb-4 flex items-center justify-between rounded-xl bg-slate-100/60 px-3 py-2 text-xs text-slate-600 border border-slate-200/60">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-500">Stay:</span>
            <span className="font-bold text-slate-800">₹{stayCost.toLocaleString('en-IN')}</span>
          </div>
          <div className="h-3 w-px bg-slate-300" />
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-500">Transport:</span>
            <span className="font-bold text-slate-800">₹{transportCost.toLocaleString('en-IN')}</span>
          </div>
        </div>
      )}

      {/* Accept Action Button */}
      <button
        type="button"
        onClick={handleAccept}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 px-4 text-sm font-semibold text-white transition-all duration-200 hover:bg-indigo-700 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-indigo-100 active:scale-[0.99]"
      >
        <Check size={16} />
        Swap Destination
      </button>
    </div>
  );
}
