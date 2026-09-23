import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadGoogleMaps } from '../../lib/googleMapsLoader'
import { scoreColor } from './scoreColor'
import { getDestinationLabel } from '../../lib/destinations'
import IndiaMap from './IndiaMap'
import Alert from '../ui/Alert'

// A muted, paper-toned map style so the live map reads as part of Sahyatri
// rather than a default Google Maps embed dropped into the page -- POI
// clutter and default saturated colours removed, landscape/roads pulled
// toward the --paper/--ash tokens.
const MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#ECEDE6' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6B7280' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ECEDE6' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#9CA08F' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#ECEDE6' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#C7CABB' }] },
  { featureType: 'road', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.local', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#B7C7C2' }] },
]

const BASE_RING_SIZE = 30
const BASE_ZOOM = 5

// Rings grow as you zoom in -- reads as "the map itself is getting bigger
// and so is the thing reporting pressure on it," rather than markers that
// stay a fixed, oddly-small pixel size while the map underneath them scales
// up. Gentle exponential growth (not 1:1 with tile scale, which would make
// a ring the size of a state by zoom 10) with a hard ceiling.
function zoomScale(zoom) {
  return Math.min(3, Math.max(1, Math.pow(1.18, zoom - BASE_ZOOM)))
}

// Plain markup + CSS, no React tree -- an OverlayView's onAdd/onRemove is
// imperative DOM code called by Google's own render loop, and mounting a
// nested React root inside it raced with React's own reconciliation of the
// outer component (confirmed live: "Attempted to synchronously unmount a
// root while React was already rendering", and the map intermittently
// failing to render at all under StrictMode's double-invoked effects).
// Breathing motion still works since it's the same global CSS keyframes
// (index.css) driving a plain SVG here instead of the PressureRing component.
function ringMarkerHTML(row) {
  const color = scoreColor(row.score)
  const isHot = row.score >= 0.6
  const animClass = isHot ? 'pressure-ring-hot' : 'pressure-ring-calm'
  const label = getDestinationLabel(row.destId)
  const scoreText = row.score == null ? '—' : Math.round(row.score * 100)
  const s = BASE_RING_SIZE
  const c = s / 2
  return `
    <div class="group relative" style="width:${s}px;height:${s}px;cursor:pointer;">
      <svg viewBox="0 0 ${s} ${s}" width="${s}" height="${s}" style="overflow:visible;">
        ${isHot ? `<circle cx="${c}" cy="${c}" r="${c * 0.84}" fill="none" stroke="${color}" stroke-width="1.6" opacity="0.5" class="${animClass}" style="transform-origin:${c}px ${c}px;animation-delay:.4s;" />` : ''}
        <circle cx="${c}" cy="${c}" r="${isHot ? c * 0.6 : c * 0.52}" fill="${color}" fill-opacity="0.18" stroke="${color}" stroke-width="2" class="${animClass}" style="transform-origin:${c}px ${c}px;" />
        <circle cx="${c}" cy="${c}" r="${c * 0.12}" fill="${color}" />
      </svg>
      <span class="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[10px] font-medium text-paper opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
        ${label} &middot; ${scoreText}/100
      </span>
    </div>
  `
}

function createRingOverlay(maps, map, row, onNavigate, getScale) {
  class RingOverlay extends maps.OverlayView {
    constructor() {
      super()
      this.anchor = null // outer div: positioned at the lat/lng, never resized
      this.scaler = null // inner div: grows/shrinks with zoom, same anchor point
      this.setMap(map)
    }
    onAdd() {
      this.anchor = document.createElement('div')
      this.anchor.style.position = 'absolute'
      this.anchor.style.transform = 'translate(-50%, -50%)'

      this.scaler = document.createElement('div')
      this.scaler.style.transformOrigin = 'center center'
      this.scaler.innerHTML = ringMarkerHTML(row)
      this.scaler.addEventListener('click', () => onNavigate(row.destId))

      this.anchor.appendChild(this.scaler)
      this.getPanes().overlayMouseTarget.appendChild(this.anchor)
    }
    draw() {
      if (!this.anchor) return
      const pos = this.getProjection()?.fromLatLngToDivPixel(new maps.LatLng(row.lat, row.lng))
      if (pos) {
        this.anchor.style.left = `${pos.x}px`
        this.anchor.style.top = `${pos.y}px`
      }
      this.scaler.style.transform = `scale(${getScale()})`
    }
    onRemove() {
      this.anchor?.remove()
      this.anchor = null
      this.scaler = null
    }
  }
  return new RingOverlay()
}

/**
 * Live India map (Google Maps JavaScript API) -- every tracked destination
 * plotted at its real lat/lng, with Google's own native pan/zoom/satellite
 * toggle. Falls back to the static outline map (IndiaMap) if the SDK fails
 * to load (missing/blocked API key, offline) -- an honest degraded state
 * rather than a blank broken panel.
 */
const FOCUS_ZOOM = 9 // close enough to read as "zoomed to this destination", not street-level tight

export default function GoogleIndiaMap({ rows, size = 'lg', focusDestId }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const overlaysRef = useRef([])
  const navigate = useNavigate()
  const [error, setError] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadGoogleMaps()
      .then((maps) => {
        // Guard against StrictMode's mount->cleanup->mount double-invoke
        // creating two Map instances in the same container.
        if (cancelled || !containerRef.current || mapRef.current) return
        mapRef.current = new maps.Map(containerRef.current, {
          center: { lat: 22.5, lng: 79 },
          zoom: 5,
          minZoom: 4,
          styles: MAP_STYLE,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          zoomControlOptions: { position: maps.ControlPosition.RIGHT_TOP },
        })
        setReady(true)
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Could not load the live map')
      })
    return () => { cancelled = true }
  }, [])

  // Rebuild markers whenever the rows or the map instance change.
  useEffect(() => {
    if (!ready || !mapRef.current) return
    const maps = window.google.maps
    // draw() is called by Google automatically on every zoom/pan change, so
    // reading the map's live zoom there (rather than tracking it separately
    // in React state) keeps ring size in sync with zero extra listeners.
    const getScale = () => zoomScale(mapRef.current.getZoom())
    const overlays = rows
      .filter((r) => typeof r.lat === 'number' && typeof r.lng === 'number')
      .map((row) => createRingOverlay(maps, mapRef.current, row, (destId) => navigate(`/explore/${destId}`), getScale))
    overlaysRef.current = overlays
    return () => {
      overlays.forEach((o) => o.setMap(null))
    }
  }, [ready, rows, navigate])

  // Selecting a destination (e.g. the Authority Dashboard's picker) pans
  // and zooms the live map to it, instead of the selector and the map
  // being two disconnected pieces of UI showing the same data.
  useEffect(() => {
    if (!ready || !mapRef.current || !focusDestId) return
    const row = rows.find((r) => r.destId === focusDestId)
    if (!row || typeof row.lat !== 'number' || typeof row.lng !== 'number') return
    mapRef.current.panTo({ lat: row.lat, lng: row.lng })
    mapRef.current.setZoom(FOCUS_ZOOM)
  }, [ready, focusDestId, rows])

  if (error) {
    return (
      <div className="space-y-3">
        <Alert tone="warning">Live map unavailable ({error}) -- showing the static map instead.</Alert>
        <IndiaMap rows={rows} size={size} />
      </div>
    )
  }

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-paper-dim">
      <div ref={containerRef} className="absolute inset-0" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-paper text-sm text-ash">
          Loading live map…
        </div>
      )}
      <div className="glass-surface pointer-events-none absolute bottom-3 left-3 flex items-center gap-3 rounded-lg px-3 py-1.5 text-[10px] text-ink/70">
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
