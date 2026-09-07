import React from 'react';
import { MapPin, Calendar, AlertTriangle, ShieldCheck, Sparkles, Navigation, Info } from 'lucide-react';
import PlaceSwapVariant from './PlaceSwapVariant';
import DateSwapVariant from './DateSwapVariant';
import DeclineButton from './DeclineButton';

/**
 * SwapCard component renders the main substitution interface, displaying side-by-side
 * recommendations for alternative destinations and alternative dates to relieve overcrowding.
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
  const requestedPressure = typeof requested.pressure === 'number' ? requested.pressure : 0.8;
  const pressurePercent = Math.round(requestedPressure * 100);

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
