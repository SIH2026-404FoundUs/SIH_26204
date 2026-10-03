import { MapPinned } from 'lucide-react';
import EverythingMap from '../components/map/EverythingMap';

/**
 * MapPreview -- "Everything on One Map": the full-bleed canvas page at
 * /map. Source/destination/travel-mode/category-toggle state all live
 * inside EverythingMap itself (driven by its own MapControls overlay), not
 * here -- this page only supplies the initial center/zoom and a one-line
 * title, so the map gets every pixel of height it can.
 *
 * Left padding follows --sidebar-w (set by Header.jsx) rather than a fixed
 * md:pl-72: this route uses RequireAuthBare so it can render its own
 * full-bleed <main>, but it still sits beside the fixed workspace sidebar,
 * and a fixed gutter left a dead strip whenever that sidebar was collapsed.
 *
 * Height is the viewport minus the sticky header (4.5rem, the same offset
 * the sidebar uses). It used to assume 65px, which is shorter than the
 * header, so the bottom of the map was cut off. dvh keeps mobile browser
 * toolbars from hiding the bottom edge; on very short screens the page
 * scrolls rather than squashing the map below a usable size.
 */
export default function MapPreview() {
  return (
    <main className="flex h-[calc(100dvh-4.5rem)] flex-1 flex-col gap-2 overflow-y-auto bg-paper px-2 py-2 transition-[padding] duration-200 sm:px-4 sm:py-3 md:pl-[calc(var(--sidebar-w,16rem)+1rem)]">
      <header className="flex shrink-0 items-center gap-2.5 px-1">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-paper">
          <MapPinned size={16} aria-hidden="true" />
        </span>
        <h1 className="font-display text-base font-semibold tracking-tight text-ink">One map</h1>
        <p className="hidden truncate text-xs text-ash sm:block">Plan, compare, route and explore without leaving the map</p>
      </header>

      <EverythingMap
        zoom={5}
        center={{ lat: 20.5937, lng: 78.9629 }}
        defaultHeatmap={false}
        className="min-h-[460px] w-full flex-1 overflow-hidden rounded-xl border border-slate-200/80 shadow-[0_20px_60px_rgba(0,0,0,.08)] sm:rounded-2xl"
      />
    </main>
  );
}
