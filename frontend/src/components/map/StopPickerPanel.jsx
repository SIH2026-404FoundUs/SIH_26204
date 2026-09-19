import { useState } from 'react';
import { MapPin, Plus, Trash2, X } from 'lucide-react';

/**
 * StopPickerPanel - Floating panel overlay for displaying and managing custom trip stops.
 *
 * Props:
 * - stops: Array of { id, name, lat, lng, type }
 * - onAddStop: function(stopObj)
 * - onRemoveStop: function(stopId)
 * - onClearStops: function()
 * - onClose: function()
 */
export default function StopPickerPanel({
  stops = [],
  onAddStop,
  onSearchAddStop,
  onRemoveStop,
  onClearStops,
  onClose
}) {
  const [customStopName, setCustomStopName] = useState('');

  const handleAddManualStop = (e) => {
    e.preventDefault();
    if (!customStopName.trim()) return;
    if (typeof onSearchAddStop === 'function') {
      onSearchAddStop(customStopName.trim());
    } else if (typeof onAddStop === 'function') {
      onAddStop({
        id: `stop_${Date.now()}`,
        name: customStopName.trim(),
        type: 'custom'
      });
    }
    setCustomStopName('');
  };

  return (
    <div className="absolute left-4 top-24 z-30 w-[min(320px,calc(100%-2rem))] rounded-2xl border border-white/70 bg-white/90 p-4 shadow-[0_20px_60px_rgba(15,23,42,.12)] backdrop-blur-2xl transition-all animate-in fade-in slide-in-from-left-4 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <MapPin size={16} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800">Trip Stops ({stops.length})</h4>
            <p className="text-[11px] font-semibold text-slate-400">Click map or add custom stops</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onClose && onClose()}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
        >
          <X size={14} />
        </button>
      </div>

      {/* Add Custom Stop Input Form */}
      <form onSubmit={handleAddManualStop} className="mt-3 flex items-center gap-2">
        <input
          type="text"
          value={customStopName}
          onChange={(e) => setCustomStopName(e.target.value)}
          placeholder="Add a stop (e.g. Viewpoint)..."
          className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
        />
        <button
          type="submit"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition"
          title="Add Stop"
        >
          <Plus size={16} />
        </button>
      </form>

      {/* List of Current Stops */}
      <div className="mt-3 max-h-48 overflow-y-auto space-y-2 pr-1">
        {stops.length === 0 ? (
          <p className="text-center py-4 text-xs font-medium text-slate-400">
            No custom stops added yet.<br />Click anywhere on the map to drop a stop!
          </p>
        ) : (
          stops.map((stop, idx) => (
            <div
              key={stop.id || `stop_${idx}`}
              className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 text-xs"
            >
              <div className="flex items-center gap-2 truncate">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">
                  {idx + 1}
                </span>
                <span className="font-semibold text-slate-800 truncate">{stop.name}</span>
              </div>
              <button
                type="button"
                onClick={() => onRemoveStop && onRemoveStop(stop.id || idx)}
                className="text-slate-400 hover:text-rose-600 transition"
                title="Remove Stop"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Footer Clear All */}
      {stops.length > 0 && (
        <div className="mt-3 pt-2 border-t border-slate-100 text-right">
          <button
            type="button"
            onClick={() => onClearStops && onClearStops()}
            className="text-[11px] font-bold text-rose-600 hover:underline"
          >
            Clear All Stops
          </button>
        </div>
      )}
    </div>
  );
}
