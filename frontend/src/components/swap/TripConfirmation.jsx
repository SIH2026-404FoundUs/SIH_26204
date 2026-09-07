import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import {
  CheckCircle2,
  MapPin,
  Calendar,
  ArrowRight,
  TrendingDown,
  IndianRupee,
  ShieldCheck,
  AlertTriangle,
  Compass,
  ArrowLeft,
  Sparkles
} from 'lucide-react';

export default function TripConfirmation() {
  const location = useLocation();
  const state = location.state || {};

  const { type = 'decline', requested = {}, selected = {} } = state;

  const requestedName = requested.displayName || requested.destId || 'Original Destination';
  const requestedPressure = typeof requested.pressure === 'number' ? requested.pressure : 0.8;
  const reqPressurePercent = Math.round(requestedPressure * 100);

  // Formatting date string helpers
  const formatDateStr = (dateString) => {
    if (!dateString) return 'Selected Date';
    try {
      const parsed = new Date(dateString);
      if (isNaN(parsed.getTime())) return dateString;
      return parsed.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  return (
    <main className="min-h-screen flex-1 bg-slate-50 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl space-y-8">
        {/* Back Link */}
        <div className="flex items-center justify-between">
          <Link
            to="/swap"
            className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 transition hover:text-indigo-700"
          >
            <ArrowLeft size={16} />
            Back to Swap Engine
          </Link>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 border border-indigo-100">
            <Sparkles size={12} />
            Itinerary Updated
          </span>
        </div>

        {/* --- CASE 1: SWAPPED DESTINATION --- */}
        {type === 'place' && (
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8 animate-in fade-in duration-300">
            {/* Success Icon & Header */}
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <CheckCircle2 size={36} />
            </div>

            <div className="text-center">
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                Destination Swap Confirmed!
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                You successfully relieved overcrowding by swapping your itinerary destination.
              </p>
            </div>

            {/* Destination Swap Flow Box */}
            <div className="mt-8 rounded-2xl bg-slate-900 p-6 text-white shadow-md">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-5 sm:items-center">
                {/* Old Destination */}
                <div className="sm:col-span-2 text-left">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400">
                    Previous Destination
                  </span>
                  <h3 className="mt-1 text-lg font-bold text-slate-300 line-through decoration-rose-500/80">
                    {requestedName}
                  </h3>
                  <span className="mt-1 inline-block text-xs font-semibold text-rose-400">
                    {reqPressurePercent}% High Pressure
                  </span>
                </div>

                {/* Arrow Divider */}
                <div className="sm:col-span-1 flex justify-center py-2 sm:py-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-white shadow-md">
                    <ArrowRight size={20} />
                  </div>
                </div>

                {/* New Destination */}
                <div className="sm:col-span-2 text-left">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                    New Destination
                  </span>
                  <h3 className="mt-1 text-xl font-extrabold text-white">
                    {selected.displayName || selected.destId}
                  </h3>
                  <span className="mt-1 inline-block text-xs font-semibold text-emerald-400">
                    {Math.round((selected.pressure ?? 0.5) * 100)}% Low Pressure
                  </span>
                </div>
              </div>
            </div>

            {/* Key Benefits Grid */}
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {/* Pressure Drop */}
              <div className="rounded-2xl border border-slate-100 bg-emerald-50/60 p-4 text-left">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
                  <TrendingDown size={16} />
                  Crowd Relief
                </div>
                <div className="mt-2 text-2xl font-extrabold text-emerald-700">
                  -{Math.round(Math.max(0, requestedPressure - (selected.pressure ?? 0.5)) * 100)}%
                </div>
                <div className="mt-0.5 text-xs text-emerald-600">Reduced traffic & congestion</div>
              </div>

              {/* Financial Savings */}
              <div className="rounded-2xl border border-slate-100 bg-amber-50/60 p-4 text-left">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-700">
                  <IndianRupee size={16} />
                  Rupee Savings
                </div>
                <div className="mt-2 text-2xl font-extrabold text-amber-800">
                  ₹{(selected.savingINR ?? 0).toLocaleString('en-IN')}
                </div>
                <div className="mt-0.5 text-xs text-amber-700">Lodging & transport savings</div>
              </div>

              {/* Travel Time */}
              <div className="rounded-2xl border border-slate-100 bg-blue-50/60 p-4 text-left">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-700">
                  <Compass size={16} />
                  Travel Time Ratio
                </div>
                <div className="mt-2 text-2xl font-extrabold text-blue-800">
                  {(selected.travelTimeRatio ?? 1.0).toFixed(1)}x
                </div>
                <div className="mt-0.5 text-xs text-blue-600">Within reachability limits</div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-8 flex justify-center">
              <Link
                to="/swap"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 px-8 text-sm font-semibold text-white transition hover:bg-indigo-700 shadow-md focus:outline-none focus:ring-4 focus:ring-indigo-100"
              >
                Plan Another Trip Swap
              </Link>
            </div>
          </div>
        )}

        {/* --- CASE 2: SHIFTED TRAVEL DATES --- */}
        {type === 'date' && (
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8 animate-in fade-in duration-300">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 border border-teal-100">
              <ShieldCheck size={36} />
            </div>

            <div className="text-center">
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                Date Shift Confirmed!
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                You successfully shifted travel dates for <strong className="text-slate-900">{requestedName}</strong> to an off-peak window.
              </p>
            </div>

            {/* Date Shift Flow Box */}
            <div className="mt-8 rounded-2xl bg-slate-900 p-6 text-white shadow-md">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-5 sm:items-center">
                {/* Old Date */}
                <div className="sm:col-span-2 text-left">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400">
                    Original Peak Date
                  </span>
                  <h3 className="mt-1 text-lg font-bold text-slate-300 line-through decoration-rose-500/80">
                    Peak Holiday Window
                  </h3>
                  <span className="mt-1 inline-block text-xs font-semibold text-rose-400">
                    {reqPressurePercent}% Crowd Pressure
                  </span>
                </div>

                {/* Arrow Divider */}
                <div className="sm:col-span-1 flex justify-center py-2 sm:py-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-600 text-white shadow-md">
                    <ArrowRight size={20} />
                  </div>
                </div>

                {/* New Date */}
                <div className="sm:col-span-2 text-left">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-teal-400">
                    New Travel Window
                  </span>
                  <h3 className="mt-1 text-xl font-extrabold text-white">
                    {formatDateStr(selected.startDate)}
                  </h3>
                  <span className="mt-1 inline-block text-xs font-semibold text-teal-400">
                    {Math.round((selected.pressure ?? 0.4) * 100)}% Off-Peak Pressure
                  </span>
                </div>
              </div>
            </div>

            {/* Key Benefits Grid */}
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-100 bg-emerald-50/60 p-4 text-left">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
                  <TrendingDown size={16} />
                  Crowd Reduction
                </div>
                <div className="mt-2 text-2xl font-extrabold text-emerald-700">
                  -{Math.round(Math.max(0, requestedPressure - (selected.pressure ?? 0.4)) * 100)}%
                </div>
                <div className="mt-0.5 text-xs text-emerald-600">Enjoy quieter, uncrowded sightseeing</div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-amber-50/60 p-4 text-left">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-700">
                  <IndianRupee size={16} />
                  Off-Peak Savings
                </div>
                <div className="mt-2 text-2xl font-extrabold text-amber-800">
                  ₹{(selected.savingINR ?? 0).toLocaleString('en-IN')}
                </div>
                <div className="mt-0.5 text-xs text-amber-700">Cheaper lodging & travel rates</div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-8 flex justify-center">
              <Link
                to="/swap"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 py-3 px-8 text-sm font-semibold text-white transition hover:bg-teal-700 shadow-md focus:outline-none focus:ring-4 focus:ring-teal-100"
              >
                Plan Another Trip Swap
              </Link>
            </div>
          </div>
        )}

        {/* --- CASE 3: DECLINED SUBSTITUTION --- */}
        {type === 'decline' && (
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8 animate-in fade-in duration-300">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-100">
              <AlertTriangle size={36} />
            </div>

            <div className="text-center">
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                Original Itinerary Maintained
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                You declined substitution options and chose to proceed with <strong className="text-slate-900">{requestedName}</strong>.
              </p>
            </div>

            {/* Warning Box */}
            <div className="mt-6 rounded-2xl bg-slate-900 p-6 text-left text-white shadow-md">
              <div className="flex items-start gap-3">
                <MapPin size={22} className="text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {requestedName}
                  </h3>
                  <p className="mt-1 text-xs text-rose-300 font-semibold">
                    Current Crowd Pressure: {reqPressurePercent}% (High Pressure)
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-slate-800 p-4 text-xs text-slate-300 border border-slate-700 leading-relaxed">
                <strong>Important Notice:</strong> During peak crowd periods, expect heavy road congestion, higher hotel tariffs, and longer wait times at popular tourist spots.
              </div>
            </div>

            {/* Actions */}
            <div className="mt-8 flex justify-center gap-4">
              <Link
                to="/swap"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 px-8 text-sm font-semibold text-white transition hover:bg-slate-800 shadow-md focus:outline-none focus:ring-4 focus:ring-slate-200"
              >
                Back to Swap Engine
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
