import { X, Navigation, Clock, IndianRupee } from 'lucide-react';
import { TRAVEL_MODES } from './travelModes';

/**
 * RouteDetailsPanel - Floating card overlay displaying travel route metrics.
 * Positioned at bottom-center of the map canvas.
 *
 * Props:
 * - routeInfo: {
 *     sourceName: string,
 *     destName: string,
 *     distanceKm: number,
 *     durationMinutes: number,
 *     fareINR: number | null,
 *     travelMode: string
 *   }
 * - onClose: function()
 */
export default function RouteDetailsPanel({ routeInfo, onClose }) {
  if (!routeInfo) return null;

  const {
    sourceName = 'Origin',
    destName = 'Destination',
    distanceKm = 0,
    durationMinutes = 0,
    fareINR = null,
    isEstimated = false,
    isUnavailable = false,
    estimateNote = null,
    travelMode = 'DRIVE',
  } = routeInfo;

  const modeConfig = TRAVEL_MODES.find((m) => m.key === travelMode) || TRAVEL_MODES[0];
  const ModeIcon = modeConfig.icon;

  // Format duration into "Xh Ym"
  const hours = durationMinutes == null ? 0 : Math.floor(durationMinutes / 60);
  const mins = durationMinutes == null ? 0 : Math.round(durationMinutes % 60);
  const formattedDuration = durationMinutes == null ? 'N/A' : hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  // Format distance
  const formattedDistance = typeof distanceKm === 'number' ? `${distanceKm.toFixed(1)} km` : 'N/A';

  return (
    <div className="absolute bottom-6 left-6 z-10 w-80 sm:w-96 rounded-2xl border border-slate-200/90 bg-white/95 p-3.5 shadow-xl backdrop-blur-md transition-all animate-in fade-in slide-in-from-left-4 duration-300">
      {/* Header with Title, Mode Badge, and Close Button */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2 truncate pr-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 font-bold text-sm shrink-0">
            {modeConfig.emoji}
          </span>
          <div className="truncate">
            <h4 className="text-xs font-bold text-slate-800 truncate flex items-center gap-1">
              <span>{sourceName}</span>
              <span className="text-slate-400">→</span>
              <span className="text-indigo-600">{destName}</span>
            </h4>
            <p className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
              <ModeIcon size={12} className="text-indigo-500" />
              <span>{isUnavailable ? modeConfig.label : `${modeConfig.label} Mode Route`}</span>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onClose && onClose()}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
          title="Close Details"
        >
          <X size={14} />
        </button>
      </div>

      {/* Metrics Grid (Distance, Duration, Estimated Fare) */}
      {estimateNote && <p className="mt-3 rounded-lg bg-amber-50 px-2.5 py-2 text-[11px] font-semibold text-amber-800">{estimateNote}</p>}
      <div className="grid grid-cols-3 gap-2 pt-3">
        {/* 1. Distance Metric */}
        <div className="flex flex-col items-center justify-center rounded-xl bg-slate-50 p-2.5 text-center border border-slate-100">
          <div className="flex items-center gap-1 text-slate-400 mb-0.5">
            <Navigation size={13} className="text-emerald-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Distance</span>
          </div>
          <span className="text-sm font-extrabold text-slate-800">{formattedDistance}</span>
        </div>

        {/* 2. Duration Metric */}
        <div className="flex flex-col items-center justify-center rounded-xl bg-slate-50 p-2.5 text-center border border-slate-100">
          <div className="flex items-center gap-1 text-slate-400 mb-0.5">
            <Clock size={13} className="text-indigo-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Duration</span>
          </div>
          <span className="text-sm font-extrabold text-slate-800">{formattedDuration}</span>
        </div>

        {/* 3. Estimated Fare Metric */}
        <div className="flex flex-col items-center justify-center rounded-xl bg-indigo-50/70 p-2.5 text-center border border-indigo-100">
          <div className="flex items-center gap-1 text-indigo-400 mb-0.5">
            <IndianRupee size={13} className="text-indigo-600" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Est. Fare</span>
          </div>
          <span className="text-sm font-extrabold text-indigo-700">
            {isEstimated || isUnavailable ? 'N/A' : fareINR !== null && fareINR !== undefined
              ? fareINR === 0
                ? 'Free'
                : `₹${Number(fareINR).toLocaleString('en-IN')}`
              : 'N/A'}
          </span>
        </div>
      </div>
    </div>
  );
}
