import { scoreColor } from '../pressure/scoreColor';

const BANDS = [
  { label: 'Calm', hint: 'under 35%', score: 0.15 },
  { label: 'Moderate', hint: '35-60%', score: 0.5 },
  { label: 'Crowded', hint: 'over 60%', score: 0.85 },
];

/**
 * PressureLegend - Key for PressureHeatmapLayer's circles. Colour alone is
 * never an acceptable sole signal, so each band is named with its range.
 * Rendered by EverythingMap in the bottom-centre slot, stacked with the
 * route card, rather than by the layer itself, so the two never overlap.
 */
export default function PressureLegend() {
  return (
    <div className="flex max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-full border border-white/70 bg-white/92 px-3.5 py-1.5 shadow-[0_10px_30px_rgba(15,23,42,.12)] backdrop-blur-2xl">
      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Crowd pressure</span>
      {BANDS.map((band) => (
        <span key={band.label} className="flex items-center gap-1.5" title={band.hint}>
          <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white" style={{ backgroundColor: scoreColor(band.score) }} aria-hidden="true" />
          <span className="text-[11px] font-semibold text-slate-700">{band.label}</span>
          <span className="hidden text-[10px] text-slate-400 @2xl:inline">{band.hint}</span>
        </span>
      ))}
      <span className="hidden text-[10px] text-slate-400 @3xl:inline">· tap a circle for its reading</span>
    </div>
  );
}
