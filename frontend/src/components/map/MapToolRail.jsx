import { useEffect, useState } from 'react';
import { Plus, Minus, Maximize2, Minimize2, LocateFixed, Layers3, Globe2 } from 'lucide-react';

function RailButton({ label, active = false, onClick, children, badge }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active || undefined}
      className={`relative flex h-9 w-9 items-center justify-center transition ${active ? 'bg-[#6C63FF] text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}
    >
      {children}
      {badge ? (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-950 px-1 text-[9px] font-bold text-white ring-2 ring-white">{badge}</span>
      ) : null}
    </button>
  );
}

// Horizontal strip on narrow maps (it sits under the route card there), a
// vertical rail on the right edge once the map is wide enough (@4xl).
function RailGroup({ children, clip = true, wideOnly = false }) {
  return (
    <div className={`${wideOnly ? 'hidden @4xl:flex' : 'flex'} divide-x divide-slate-100 rounded-xl border border-white/70 bg-white/92 shadow-[0_10px_30px_rgba(15,23,42,.14)] backdrop-blur-2xl @4xl:flex-col @4xl:divide-x-0 @4xl:divide-y ${clip ? 'overflow-hidden' : '[&>button]:rounded-xl'}`}>
      {children}
    </div>
  );
}

/**
 * MapToolRail - The map's own controls (zoom, reset, locate, fullscreen,
 * layers) in one stack on the right edge. Replaces Google's default zoom and
 * fullscreen buttons, which sat underneath the floating panels.
 */
export default function MapToolRail({ map, containerRef, homeCenter, homeZoom, locating, onLocate, layersOpen, onToggleLayers, activeLayerCount = 0 }) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement) && document.fullscreenElement === containerRef?.current);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, [containerRef]);

  const zoomBy = (delta) => {
    if (!map) return;
    map.setZoom((map.getZoom() || 5) + delta);
  };

  const resetView = () => {
    if (!map) return;
    map.panTo(homeCenter);
    map.setZoom(homeZoom);
  };

  const toggleFullscreen = () => {
    const el = containerRef?.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else el.requestFullscreen?.().catch(() => {});
  };

  return (
    <div className="flex items-end gap-2 @4xl:flex-col">
      {/* Not clipped, so the active-layer badge can overhang the corner */}
      <RailGroup clip={false}>
        <RailButton label={layersOpen ? 'Hide map layers' : 'Map layers'} active={layersOpen} onClick={onToggleLayers} badge={activeLayerCount || null}>
          <Layers3 size={17} />
        </RailButton>
      </RailGroup>
      <RailGroup>
        <RailButton label="Show my location" active={locating} onClick={onLocate}>
          <LocateFixed size={17} />
        </RailButton>
        <RailButton label="Reset to all of India" onClick={resetView}>
          <Globe2 size={17} />
        </RailButton>
        {document.fullscreenEnabled && (
          <RailButton label={isFullscreen ? 'Exit full screen' : 'Full screen'} onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </RailButton>
        )}
      </RailGroup>
      {/* Touch-sized maps have pinch zoom; the buttons only earn their space on wider maps */}
      <RailGroup wideOnly>
        <RailButton label="Zoom in" onClick={() => zoomBy(1)}>
          <Plus size={17} />
        </RailButton>
        <RailButton label="Zoom out" onClick={() => zoomBy(-1)}>
          <Minus size={17} />
        </RailButton>
      </RailGroup>
    </div>
  );
}
