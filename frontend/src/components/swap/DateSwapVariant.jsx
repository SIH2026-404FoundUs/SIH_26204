import React from 'react';
import { Calendar, TrendingDown, IndianRupee, Check, ShieldCheck } from 'lucide-react';

/**
 * DateSwapVariant component displays a single date shift recommendation for the requested destination.
 * Shows formatted alternative start date, pressure reduction, and rupee savings.
 *
 * @param {Object} props
 * @param {Object} props.dateObj - Candidate date object from backend response
 * @param {number} [props.requestedPressure=0.8] - Pressure score of requested destination on original date
 * @param {Function} [props.onAccept] - Optional callback when user accepts this date alternative
 */
export default function DateSwapVariant({ dateObj, requestedPressure = 0.8, onAccept }) {
  if (!dateObj) return null;

  const { startDate, pressure = 0.4, savingINR = 0 } = dateObj;

  // Format date string nicely e.g. "Dec 20, 2026"
  const formatDateStr = (dateString) => {
    if (!dateString) return '';
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

  const formattedDate = formatDateStr(startDate);

  // Pressure relief reduction
  const pressureRelief = Math.max(0, requestedPressure - pressure);
  const pressureReliefPercent = Math.round(pressureRelief * 100);
  const candidatePressurePercent = Math.round(pressure * 100);

  const handleAccept = () => {
    console.log('[SwapEngine] Accept Date Alternative triggered:', { startDate, dateObj });
    if (typeof onAccept === 'function') {
      onAccept(dateObj);
    }
  };

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md">
      {/* Header Badge */}
      <div className="mb-4 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-700 border border-teal-100">
          <ShieldCheck size={12} className="text-teal-600" />
          Optimal Low-Crowd Window
        </span>

        {savingINR > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 border border-amber-200/60">
            <IndianRupee size={12} />
            Save ₹{savingINR.toLocaleString('en-IN')}
          </span>
        )}
      </div>

      {/* Alternative Date Display */}
      <div className="mb-4">
        <h3 className="flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900 group-hover:text-teal-600 transition-colors">
          <Calendar size={18} className="text-teal-500 shrink-0" />
          {formattedDate}
        </h3>
        <p className="mt-0.5 text-xs text-slate-400">Same destination, shifted travel dates</p>
      </div>

      {/* Metrics Row */}
      <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 border border-slate-100">
        {/* Pressure Drop */}
        <div className="flex flex-col items-center text-center p-2 rounded-lg bg-white shadow-2xs border border-slate-100">
          <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
            <TrendingDown size={11} className="text-emerald-500" />
            Pressure Relief
          </span>
          <span className="mt-0.5 text-base font-extrabold text-emerald-600">
            -{pressureReliefPercent}%
          </span>
          <span className="text-[10px] text-slate-400">Score {candidatePressurePercent}%</span>
        </div>

        {/* Financial Savings */}
        <div className="flex flex-col items-center text-center p-2 rounded-lg bg-white shadow-2xs border border-slate-100">
          <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
            <IndianRupee size={11} className="text-amber-500" />
            Trip Savings
          </span>
          <span className="mt-0.5 text-base font-extrabold text-slate-800">
            ₹{savingINR.toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] text-emerald-600 font-semibold">Lower Hotel Rates</span>
        </div>
      </div>

      {/* Accept Date Shift Button */}
      <button
        type="button"
        onClick={handleAccept}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-2.5 px-4 text-sm font-semibold text-white transition-all duration-200 hover:bg-teal-700 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-teal-100 active:scale-[0.99]"
      >
        <Check size={16} />
        Shift Trip Dates
      </button>
    </div>
  );
}
