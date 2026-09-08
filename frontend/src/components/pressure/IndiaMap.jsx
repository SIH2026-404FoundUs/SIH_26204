import { Link } from 'react-router-dom'
import { useCallback, useRef, useState } from 'react'
import { Plus, Minus, Maximize2 } from 'lucide-react'
import PressureRing from './PressureRing'
import { scoreColor } from './scoreColor'
import { projectToMap } from './projection'
import { getDestinationLabel } from '../../lib/destinations'

const MIN_SCALE = 1
const MAX_SCALE = 6
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

/**
 * The isobar map generalised to the whole country (UI/UX doc §7.1): every
 * tracked destination plotted at its real lat/lng on a real India outline
 * (public/india-map.svg, state boundaries from simplemaps.com). Zoomable and
 * pannable -- clustered destinations (Himachal Pradesh, Telangana) are close
 * together at the whole-country scale, so a static map can't tell them apart;
 * scroll/pinch or the +/- controls to separate them without leaving the map.
 * Purely presentational -- takes the rows the pressure-map endpoint already
 * returns (now carrying lat/lng); fetches nothing itself.
 */
export default function IndiaMap({ rows, size = 'lg' }) {
  const [hoveredId, setHoveredId] = useState(null)
  const [view, setView] = useState({ scale: 1, panX: 0, panY: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef(null)
  const dragRef = useRef(null)

  const plotted = rows
    .map((row) => ({ row, pos: projectToMap(row.lat, row.lng) }))
    .filter((p) => p.pos)

  const ringSize = size === 'lg' ? 30 : 20

  // Cursor-anchored zoom: with transform: scale(s) translate(pan) and a
  // center transform-origin, the point currently under the cursor stays
  // under the cursor after the scale changes, rather than the view jumping
  // to re-center on the map's middle every time someone scrolls.
  const zoomBy = useCallback((factor, clientX, clientY) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const cx = clientX != null ? clientX - rect.left - rect.width / 2 : 0
    const cy = clientY != null ? clientY - rect.top - rect.height / 2 : 0
    setView(({ scale, panX, panY }) => {
      const nextScale = clamp(scale * factor, MIN_SCALE, MAX_SCALE)
      const px = cx / scale - panX
      const py = cy / scale - panY
      let nextPanX = cx / nextScale - px
      let nextPanY = cy / nextScale - py
      if (nextScale === MIN_SCALE) { nextPanX = 0; nextPanY = 0 }
      const maxPan = (rect.width / 2) * (nextScale - 1) / nextScale
      nextPanX = clamp(nextPanX, -maxPan, maxPan)
      nextPanY = clamp(nextPanY, -maxPan, maxPan)
      return { scale: nextScale, panX: nextPanX, panY: nextPanY }
    })
  }, [])

  const handleWheel = (e) => {
    e.preventDefault()
    zoomBy(e.deltaY < 0 ? 1.2 : 1 / 1.2, e.clientX, e.clientY)
  }

  const handleMouseDown = (e) => {
    if (view.scale === MIN_SCALE) return
    setIsDragging(true)
    dragRef.current = { x: e.clientX, y: e.clientY }
  }
  const handleMouseMove = (e) => {
    if (!isDragging || !dragRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const dx = (e.clientX - dragRef.current.x) / view.scale
    const dy = (e.clientY - dragRef.current.y) / view.scale
    dragRef.current = { x: e.clientX, y: e.clientY }
    setView((v) => {
      const maxPan = (rect.width / 2) * (v.scale - 1) / v.scale
      return {
        ...v,
        panX: clamp(v.panX + dx, -maxPan, maxPan),
        panY: clamp(v.panY + dy, -maxPan, maxPan),
      }
    })
  }
  const stopDragging = () => { setIsDragging(false); dragRef.current = null }

  const resetView = () => setView({ scale: 1, panX: 0, panY: 0 })

  return (
    <div
      ref={containerRef}
      className="relative aspect-square w-full overflow-hidden rounded-lg border border-paper-dim bg-white"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={stopDragging}
      onMouseLeave={stopDragging}
      style={{ cursor: view.scale > MIN_SCALE ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
    >
      <div
        className="absolute inset-0"
        style={{
          transform: `scale(${view.scale}) translate(${view.panX}px, ${view.panY}px)`,
          transformOrigin: 'center center',
          transition: isDragging ? 'none' : 'transform 0.15s ease-out',
        }}
      >
        <img src="/india-map.svg" alt="" aria-hidden="true" className="absolute inset-0 h-full w-full select-none object-contain" draggable={false} />

        {plotted.map(({ row, pos }) => {
          const isHovered = hoveredId === row.destId
          return (
            <Link
              key={row.destId}
              to={`/explore/${row.destId}`}
              className="group absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${pos.leftPct}%`, top: `${pos.topPct}%`, zIndex: isHovered ? 20 : 1 }}
              onMouseEnter={() => setHoveredId(row.destId)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={(e) => { if (isDragging) e.preventDefault() }}
            >
              {/* No counter-scale here -- rings live inside the same
                  transformed wrapper as the map image, so they grow with it
                  as someone zooms in, same as the live Google map's rings. */}
              <PressureRing score={row.score} variant={row.score >= 0.6 ? 'requested' : 'alternative'} size={ringSize} />
              <span className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[10px] font-medium text-paper opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                {getDestinationLabel(row.destId)} &middot; {row.score == null ? '—' : Math.round(row.score * 100)}/100
              </span>
            </Link>
          )
        })}
      </div>

      {/* Zoom controls -- wheel/drag work for anyone who finds them, but
          they shouldn't be the only way in (discoverability, touch devices
          without pinch support here). */}
      <div className="glass-surface absolute right-3 top-3 flex flex-col overflow-hidden rounded-lg shadow-sm">
        <button type="button" onClick={() => zoomBy(1.4)} aria-label="Zoom in" className="flex h-8 w-8 items-center justify-center text-ink/70 transition hover:bg-ink/5">
          <Plus size={15} aria-hidden="true" />
        </button>
        <div className="h-px bg-paper-dim" />
        <button type="button" onClick={() => zoomBy(1 / 1.4)} aria-label="Zoom out" className="flex h-8 w-8 items-center justify-center text-ink/70 transition hover:bg-ink/5">
          <Minus size={15} aria-hidden="true" />
        </button>
        {view.scale > MIN_SCALE && (
          <>
            <div className="h-px bg-paper-dim" />
            <button type="button" onClick={resetView} aria-label="Reset zoom" className="flex h-8 w-8 items-center justify-center text-ink/70 transition hover:bg-ink/5">
              <Maximize2 size={13} aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      {/* Colour is never the only signal (§9) -- every ring pairs colour
          with a plain-English word wherever its score is shown. */}
      <div className="glass-surface absolute bottom-3 right-3 flex items-center gap-3 rounded-lg px-3 py-1.5 text-[10px] text-ink/70">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: scoreColor(0.8) }} />
          Crowded
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: scoreColor(0.2) }} />
          Calm
        </span>
      </div>
    </div>
  )
}
