import { Compass, Layers3, MapPinned, Route, Sparkles, Utensils } from 'lucide-react';
import EverythingMap from '../components/map/EverythingMap';

/**
 * MapPreview -- "Everything on One Map": the full-bleed canvas page at
 * /map. Source/destination/travel-mode/category-toggle state all live
 * inside EverythingMap itself (driven by its own MapControls overlay), not
 * here -- this page only supplies the initial center/zoom and its own
 * compact, canvas-first chrome around it.
 *
 * A slim custom header rather than the shared PageHeader component on
 * purpose: PageHeader's own bottom margin would eat into the map's already
 * viewport-constrained height, and this page has no description line to
 * carry -- the map is the entire point of the page.
 */
export default function MapPreview() {
  return (
    <main className="flex-1 bg-paper px-3 py-3 sm:px-4 flex flex-col h-[calc(100vh-65px)] overflow-hidden">
      <div className="mx-auto w-full max-w-[98vw] flex flex-col flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-paper shadow-sm">
              <MapPinned size={18} aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Compass className="h-4 w-4 text-pressure" aria-hidden="true" />
                <h1 className="font-display text-base font-semibold tracking-tight text-ink">One-map command center</h1>
              </div>
              <p className="mt-0.5 text-[11px] font-medium text-ash">Plan, compare, route, and explore without leaving the map</p>
            </div>
          </div>
          <div className="hidden items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-ash md:flex">
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1"><Route size={12} /> Routes</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-amber-700"><Layers3 size={12} /> Pressure</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 text-indigo-700"><Utensils size={12} /> Places</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-emerald-700"><Sparkles size={12} /> Planner</span>
          </div>
        </div>

        <div className="mt-1 overflow-hidden rounded-[24px] border border-white/60 bg-white/55 p-1 shadow-[0_20px_60px_rgba(0,0,0,.08)] backdrop-blur-xl">
          <EverythingMap
            zoom={5}
            center={{ lat: 20.5937, lng: 78.9629 }}
            defaultHeatmap={false}
            className="h-[calc(100vh-140px)] min-h-[550px] w-full rounded-xl overflow-hidden"
          />
        </div>
      </div>
    </main>
  );
}
