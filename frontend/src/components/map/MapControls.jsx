import { Flame, Calendar } from 'lucide-react';

/**
 * MapControls - Floating control panel for toggling map layers and settings.
 *
 * Props:
 * - heatmapVisible: boolean
 * - onToggleHeatmap: function(boolean)
 * - date: string (YYYY-MM-DD)
 * - onChangeDate: function(string)
 */
export default function MapControls({
  heatmapVisible = false,
  onToggleHeatmap,
  date = '2026-12-26',
  onChangeDate
}) {
  return (
    <div className="absolute top-4 right-4 z-10 flex flex-col gap-2.5 rounded-2xl border border-slate-200/80 bg-white/90 p-3 shadow-md backdrop-blur-md transition-all sm:flex-row sm:items-center">
      {/* Heatmap Layer Toggle */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-1.5">
          <Flame
            size={16}
            className={heatmapVisible ? 'text-amber-500 animate-pulse' : 'text-slate-400'}
          />
          <span className="text-xs font-semibold text-slate-700">Pressure Heatmap</span>
        </div>

        <button
          type="button"
          onClick={() => onToggleHeatmap && onToggleHeatmap(!heatmapVisible)}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 ${
            heatmapVisible ? 'bg-amber-500' : 'bg-slate-300'
          }`}
          role="switch"
          aria-checked={heatmapVisible}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
              heatmapVisible ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      <div className="hidden h-5 w-px bg-slate-200 sm:block" />

      {/* Date Selector */}
      <div className="flex items-center gap-2">
        <Calendar size={15} className="text-indigo-500 shrink-0" />
        <input
          type="date"
          value={date}
          onChange={(e) => onChangeDate && onChangeDate(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
      </div>
    </div>
  );
}
