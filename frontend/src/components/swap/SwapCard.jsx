import React from 'react';
import {
  MapPin,
  Calendar,
  AlertTriangle,
  ShieldCheck,
  Sparkles,
  Navigation,
  Info,
  CheckCircle2,
  TrendingDown,
  IndianRupee,
  Compass,
  ArrowRight
} from 'lucide-react';
import PlaceSwapVariant from './PlaceSwapVariant';
import DateSwapVariant from './DateSwapVariant';
import DeclineButton from './DeclineButton';

/**
 * SwapCard component renders the substitution interface.
 * If requestedPressure <= 0.65 (Normal/Low Pressure), it displays an Optimal Travel Confirmation view.
 * If requestedPressure > 0.65 (High Pressure), it displays side-by-side alternative destinations & dates.
 *
 * @param {Object} props
 * @param {Object} props.data - Backend response containing requested info, places, dates, relaxedRelief
 * @param {Function} [props.onAcceptPlace] - Callback stub when a place alternative is accepted
 * @param {Function} [props.onAcceptDate] - Callback stub when a date alternative is accepted
 * @param {Function} [props.onDecline] - Callback stub when substitution is declined
 */
export default function SwapCard({ data, onAcceptPlace, onAcceptDate, onDecline }) {
  if (!data || !data.requested) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-xs">
        <Info size={32} className="mx-auto mb-2 text-slate-400" />
        <p className="text-sm font-medium">No substitution data available.</p>
      </div>
    );
  }

  const { requested, places = [], dates = [], relaxedRelief = false } = data;
  const requestedName = requested.displayName || requested.destId || 'Requested Destination';
  const requestedPressure = typeof requested.pressure === 'number' ? requested.pressure : 0.5;
  const pressurePercent = Math.round(requestedPressure * 100);

  const isLowPressure = requestedPressure <= 0.65;

  // --- CASE 1: LOW / NORMAL PRESSURE (P <= 0.65) ---
  // No need for alternatives. Display Optimal Travel Window confirmation card.
  if (isLowPressure) {
    return (
      <div className="mx-auto w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xl sm:p-8 animate-in fade-in duration-300">
        {/* Header Banner */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
                <ShieldCheck size={18} />
              </span>
              <h2 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
                Optimal Travel Window Confirmed
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm">
              Live crowd pressure analysis for your selected destination
            </p>
          </div>

          {/* Low Pressure Badge */}
          <div className="inline-flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-2.5 border border-emerald-200/80">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            <div>
              <div className="text-xs font-semibold text-emerald-800">Uncrowded Destination</div>
              <div className="text-xs text-emerald-600 font-bold">{pressurePercent}% Low Pressure</div>
            </div>
          </div>
        </div>

        {/* Hero Banner */}
        <div className="mb-8 rounded-2xl bg-slate-900 p-6 text-white shadow-md">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                <MapPin size={24} />
              </span>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                  Target Destination
                </span>
                <h3 className="text-xl font-extrabold text-white sm:text-2xl">
                  {requestedName}
                </h3>
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-950 px-3.5 py-2 text-xs font-semibold text-emerald-400 border border-emerald-800">
              <Sparkles size={14} />
              No Substitution Needed
            </div>
          </div>
        </div>

        {/* Highlight Message */}
        <div className="mb-8 rounded-2xl border border-emerald-200/80 bg-emerald-50/60 p-6 text-left shadow-2xs">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={24} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-base font-bold text-emerald-900">
                Perfect Time to Visit!
              </h4>
              <p className="mt-1 text-sm leading-relaxed text-emerald-800">
                Great news! <strong>{requestedName}</strong> is experiencing minimal crowd pressure (<strong>{pressurePercent}%</strong>) on your travel dates. You will enjoy an uncrowded atmosphere, smooth transit, and competitive lodging rates without needing any destination or date swaps.
              </p>
            </div>
          </div>
        </div>

        {/* Metric Highlights Grid */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Crowd Score */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-center">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-center gap-1">
              <TrendingDown size={13} className="text-emerald-500" />
              Crowd Pressure
            </span>
            <div className="mt-2 text-2xl font-extrabold text-emerald-600">
              {pressurePercent}%
            </div>
            <div className="mt-0.5 text-xs text-slate-500 font-medium">Low & Comfortable</div>
          </div>

          {/* Cost & Savings */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-center">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-center gap-1">
              <IndianRupee size={13} className="text-amber-500" />
              Pricing Level
            </span>
            <div className="mt-2 text-2xl font-extrabold text-slate-800">
              Best Savings
            </div>
            <div className="mt-0.5 text-xs text-slate-500 font-medium">Standard Off-Peak Rates</div>
          </div>

          {/* Travel Transit */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-center">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-center gap-1">
              <Compass size={13} className="text-blue-500" />
              Transit Status
            </span>
            <div className="mt-2 text-2xl font-extrabold text-slate-800">
              Zero Traffic
            </div>
            <div className="mt-0.5 text-xs text-slate-500 font-medium">Smooth Highway Access</div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-center border-t border-slate-100 pt-6">
          <button
            type="button"
            onClick={() => {
              console.log('[SwapCard] Confirmed itinerary for low pressure destination:', requestedName);
              if (typeof onDecline === 'function') onDecline();
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 px-8 text-sm font-bold text-white transition hover:bg-slate-800 shadow-md focus:outline-none focus:ring-4 focus:ring-slate-200 active:scale-[0.99]"
          >
            Proceed with Itinerary ({requestedName})
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  // --- CASE 2: HIGH PRESSURE (P > 0.65) ---
  // Overcrowding detected. Render side-by-side place and date alternatives.
  const hasPlaces = Array.isArray(places) && places.length > 0;
  const hasDates = Array.isArray(dates) && dates.length > 0;

  return (
    <div className="mx-auto w-full max-w-5xl rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xl sm:p-8">
      {/* Header Banner */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
              <Sparkles size={18} />
            </span>
            <h2 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
              Smart Travel Swap Engine
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">
            Intelligent overcrowding relief recommendations tailored to your trip profile
          </p>
        </div>

        {/* Overcrowding Status Badge */}
        <div className="inline-flex items-center gap-2 rounded-2xl bg-rose-50 px-4 py-2.5 border border-rose-200/80">
          <AlertTriangle size={18} className="text-rose-600 shrink-0" />
          <div>
            <div className="text-xs font-semibold text-rose-800">High Crowd Pressure</div>
            <div className="text-xs text-rose-600 font-bold">{pressurePercent}% Overcrowded</div>
          </div>
        </div>
      </div>

      {/* Requested Destination Banner */}
      <div className="mb-8 rounded-2xl bg-slate-900 p-5 text-white shadow-md">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-indigo-400 border border-slate-700 shrink-0">
              <MapPin size={20} />
            </span>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">
                Your Initial Destination
              </span>
              <h3 className="text-lg font-bold text-white sm:text-xl">
                {requestedName}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-300">
            <span className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 border border-slate-700">
              <Navigation size={13} className="text-indigo-400" />
              Requested Trip
            </span>
            {relaxedRelief && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-950 px-3 py-1.5 text-emerald-400 border border-emerald-800">
                <ShieldCheck size={13} />
                Dynamic Relief Active
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Side-by-Side Alternatives Grid */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Left Column: Place Alternatives */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <MapPin size={18} className="text-indigo-600" />
              Alternative Destinations ({places.length})
            </h3>
            <span className="text-xs text-slate-400">Same attributes & lower crowds</span>
          </div>

          {hasPlaces ? (
            <div className="space-y-4">
              {places.map((place) => (
                <PlaceSwapVariant
                  key={place.destId || place.displayName}
                  place={place}
                  requestedPressure={requestedPressure}
                  onAccept={onAcceptPlace}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-slate-400 text-xs">
              No alternative destinations match your similarity and travel time constraints.
            </div>
          )}
        </div>

        {/* Right Column: Date Alternatives */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Calendar size={18} className="text-teal-600" />
              Alternative Dates ({dates.length})
            </h3>
            <span className="text-xs text-slate-400">Same place, off-peak windows</span>
          </div>

          {hasDates ? (
            <div className="space-y-4">
              {dates.map((dateObj, idx) => (
                <DateSwapVariant
                  key={dateObj.startDate || idx}
                  dateObj={dateObj}
                  requestedPressure={requestedPressure}
                  onAccept={onAcceptDate}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-slate-400 text-xs">
              No alternative travel dates available within the current window.
            </div>
          )}
        </div>
      </div>

      {/* Bottom Action Section: Decline Button */}
      <div className="mt-8 border-t border-slate-100 pt-6">
        <DeclineButton onDecline={onDecline} requestedName={requestedName} />
      </div>
    </div>
  );
}
