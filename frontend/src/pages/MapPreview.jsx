import { Compass } from 'lucide-react';
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
        <div className="flex items-center justify-between py-1 px-2">
          <div className="flex items-center gap-2">
            <Compass className="h-5 w-5 text-pressure" aria-hidden="true" />
            <h1 className="font-display text-base text-ink tracking-tight">Map -- everything in one view</h1>
          </div>
          <span className="hidden text-xs font-medium text-ash sm:inline">Route, crowding, and nearby places</span>
        </div>

        <div className="mt-1 overflow-hidden rounded-2xl border border-paper-dim bg-white shadow-sm p-1">
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
