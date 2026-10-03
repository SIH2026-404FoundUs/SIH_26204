import { useState } from 'react';
import { Loader2, MapPinPlus, Milestone, Plus, Search, Trash2, X } from 'lucide-react';

/**
 * StopPickerPanel - Manage the custom stops on the current route.
 * While this panel is open, clicking the map drops a stop (EverythingMap only
 * listens for those clicks in this mode, so a stray click elsewhere never
 * adds one).
 *
 * Props:
 * - stops: Array of { id, name, lat, lng, type }
 * - onSearchAddStop: function(query)
 * - isSearching: a search is in flight
 * - onRemoveStop: function(stopId)
 * - onClearStops: function()
 * - onClose: function()
 */
export default function StopPickerPanel({
  stops = [],
  onAddStop,
  onSearchAddStop,
  isSearching = false,
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
    <section className="w-full rounded-2xl border border-white/70 bg-white/92 p-3.5 shadow-[0_20px_60px_rgba(15,23,42,.12)] backdrop-blur-2xl animate-fade-up" aria-label="Trip stops">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-100">
            <Milestone size={16} />
          </span>
          <div>
            <h4 className="text-sm font-extrabold text-slate-900">Stops along the way</h4>
            <p className="text-[11px] font-medium text-slate-400">{stops.length ? `${stops.length} stop${stops.length > 1 ? 's' : ''} on this route` : 'Search, or click the map to drop a pin'}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onClose && onClose()}
          className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close stops panel"
        >
          <X size={15} />
        </button>
      </div>

      <form onSubmit={handleAddManualStop} className="mt-3 flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 py-1 pl-2.5 pr-1 transition focus-within:border-[#6C63FF]/50 focus-within:bg-white focus-within:ring-4 focus-within:ring-[#6C63FF]/10">
        <Search size={14} className="shrink-0 text-slate-400" />
        <input
          type="text"
          value={customStopName}
          onChange={(e) => setCustomStopName(e.target.value)}
          placeholder="Search a place, e.g. Solang Valley"
          aria-label="Search a place to add as a stop"
          className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-slate-800 outline-none placeholder:font-medium placeholder:text-slate-400"
        />
        <button
          type="submit"
          disabled={isSearching || !customStopName.trim()}
          className="flex h-7 items-center gap-1 rounded-lg bg-slate-950 px-2.5 text-[11px] font-bold text-white transition hover:bg-[#6C63FF] disabled:bg-slate-300"
        >
          {isSearching ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          Add
        </button>
      </form>

      <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-[#6C63FF]/8 px-2.5 py-1.5 text-[11px] font-semibold text-[#5b52e6]">
        <MapPinPlus size={13} className="shrink-0" />
        Click anywhere on the map to drop a stop
      </p>

      {stops.length > 0 && (
        <>
          <ol className="relative mt-3 max-h-52 space-y-1 overflow-y-auto pr-1">
            {stops.map((stop, idx) => (
              <li
                key={stop.id || `stop_${idx}`}
                className="group flex items-center gap-2.5 rounded-xl px-1.5 py-1.5 text-xs transition hover:bg-slate-50"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[10px] font-extrabold text-white shadow-sm">
                  {idx + 1}
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold text-slate-700" title={stop.name}>{stop.name}</span>
                <button
                  type="button"
                  onClick={() => onRemoveStop && onRemoveStop(stop.id || idx)}
                  className="rounded-md p-1 text-slate-300 transition hover:bg-rose-50 hover:text-rose-600 group-hover:text-slate-400"
                  aria-label={`Remove ${stop.name}`}
                >
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ol>
          <div className="mt-2 flex justify-end border-t border-slate-100 pt-2">
            <button
              type="button"
              onClick={() => onClearStops && onClearStops()}
              className="rounded-lg px-2 py-1 text-[11px] font-bold text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
            >
              Clear all
            </button>
          </div>
        </>
      )}
    </section>
  );
}
