import { useEffect, useRef, useState } from 'react'
import { MapPin, Search } from 'lucide-react'
import { loadGoogleMaps } from '../../../lib/googleMapsLoader'
import Alert from '../../ui/Alert'
import { inputClass } from '../../ui/FormField'

// Click/drag-to-place-a-marker map, purpose-built for Suggest a Place --
// deliberately NOT EverythingMap (route planning, heatmap layers, category
// markers): this only ever needs "let the traveller point at one spot and
// hand back its coordinates," so it stays its own small component rather
// than threading an unrelated set of props through the much larger map.
//
// Search-by-name uses the NEW Places API (AutocompleteSuggestion), not the
// legacy google.maps.places.Autocomplete widget -- the legacy Places API
// is not enabled on this project's Maps key ("legacy API... not enabled
// for your project" / "not available to new customers" as of March 2025),
// confirmed live against the real API. AutocompleteSuggestion is a plain
// data API (not a custom `<gmp-place-autocomplete>` element), so it renders
// as a normal dropdown under a normal <input> instead of Google's own
// unthemed widget.
//
// The requirement this exists for: the traveller must never type latitude/
// longitude by hand. Search is by place NAME, not coordinates -- lat/lng
// values only ever get produced from a real click, drag, or search result
// on a real map, and the parent form only ever receives them via onChange,
// never renders an input for them.
export default function LocationPickerMap({ value, onChange }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const placesLibRef = useRef(null)
  const sessionTokenRef = useRef(null)
  const debounceRef = useRef(null)
  const blurCloseRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadGoogleMaps()
      .then(async (maps) => {
        if (cancelled || !containerRef.current || mapRef.current) return
        const center = value || { lat: 20.5937, lng: 78.9629 } // India centre until a point is picked
        const map = new maps.Map(containerRef.current, {
          center,
          zoom: value ? 11 : 5,
          // A Map ID is required for AdvancedMarkerElement to render at all --
          // DEMO_MAP_ID is Google's documented placeholder for this (no cloud
          // styling attached to it). Override with VITE_GOOGLE_MAPS_MAP_ID once
          // a real Map ID is created in Cloud Console.
          mapId: import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID',
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        })
        mapRef.current = map

        const hasAdvanced = maps.marker && typeof maps.marker.AdvancedMarkerElement === 'function'

        const createDraggableMarker = (position) => {
          if (hasAdvanced) {
            const el = new maps.marker.AdvancedMarkerElement({ position, map, gmpDraggable: true })
            el.addListener('dragend', (e) => onChange({ lat: e.latLng.lat(), lng: e.latLng.lng() }))
            return el
          }
          const el = new maps.Marker({ position, map, draggable: true })
          el.addListener('dragend', (e) => onChange({ lat: e.latLng.lat(), lng: e.latLng.lng() }))
          return el
        }

        const placeMarker = (position) => {
          if (markerRef.current) {
            if (hasAdvanced) markerRef.current.position = position
            else markerRef.current.setPosition(position)
          } else {
            markerRef.current = createDraggableMarker(position)
          }
          const lat = typeof position.lat === 'function' ? position.lat() : position.lat
          const lng = typeof position.lng === 'function' ? position.lng() : position.lng
          onChange({ lat, lng })
        }

        map.addListener('click', (e) => placeMarker(e.latLng))

        if (value) {
          markerRef.current = createDraggableMarker(value)
        }

        map._placeMarker = placeMarker // used by the search-result handler below

        try {
          placesLibRef.current = await maps.importLibrary('places')
          sessionTokenRef.current = new placesLibRef.current.AutocompleteSessionToken()
        } catch {
          // Search stays unavailable if this fails; clicking the map still works.
        }

        setReady(true)
      })
      .catch((err) => !cancelled && setError(err?.message || 'Could not load the map'))
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleQueryChange(e) {
    const text = e.target.value
    setQuery(text)
    clearTimeout(debounceRef.current)
    if (!text.trim() || !placesLibRef.current) {
      setSuggestions([])
      setDropdownOpen(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const { suggestions: results } = await placesLibRef.current.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: text,
          sessionToken: sessionTokenRef.current,
          includedRegionCodes: ['in'], // India-only platform
        })
        setSuggestions(results.filter((s) => s.placePrediction))
        setDropdownOpen(true)
      } catch {
        setSuggestions([])
      } finally {
        setIsSearching(false)
      }
    }, 300)
  }

  async function selectSuggestion(suggestion) {
    const prediction = suggestion.placePrediction
    setQuery(prediction.text?.text || '')
    setDropdownOpen(false)
    setSuggestions([])
    try {
      const place = prediction.toPlace()
      await place.fetchFields({ fields: ['location'] })
      const location = place.location
      if (!location || !mapRef.current) return
      mapRef.current.setCenter(location)
      mapRef.current.setZoom(14)
      mapRef.current._placeMarker(location)
      // Fresh session token for the next search (billing best practice: one
      // token per autocomplete session, from first keystroke to selection).
      sessionTokenRef.current = new placesLibRef.current.AutocompleteSessionToken()
    } catch {
      // Selection just doesn't move the map; the traveller can still tap it directly.
    }
  }

  if (error) {
    return <Alert tone="warning">Map unavailable ({error}) -- you can't select a location right now.</Alert>
  }

  return (
    <div className="space-y-2">
      <div className="relative" onBlur={() => { blurCloseRef.current = setTimeout(() => setDropdownOpen(false), 150) }}>
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ash" aria-hidden="true" />
        <input
          type="text"
          value={query}
          onChange={handleQueryChange}
          onFocus={() => { clearTimeout(blurCloseRef.current); if (suggestions.length > 0) setDropdownOpen(true) }}
          placeholder="Search for a place…"
          disabled={!ready}
          className={`${inputClass} pl-9`}
        />
        {dropdownOpen && suggestions.length > 0 && (
          <ul role="listbox" className="glass-surface absolute z-10 mt-1 w-full overflow-hidden rounded-lg shadow-lg">
            {suggestions.map((s) => (
              <li key={s.placePrediction.placeId}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()} // keep input focus so onBlur doesn't fire before the click
                  onClick={() => selectSuggestion(s)}
                  className="block w-full px-3 py-2 text-left text-sm text-ink hover:bg-ink/5"
                >
                  {s.placePrediction.text?.text}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="relative h-64 w-full overflow-hidden rounded-lg border border-paper-dim bg-paper-dim/40">
        <div ref={containerRef} className="absolute inset-0" />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-ash">Loading map…</div>
        )}
      </div>
      <p className="flex items-center gap-1.5 text-xs text-ash">
        <MapPin size={13} aria-hidden="true" />
        {value
          ? `Selected: ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}`
          : isSearching
            ? 'Searching…'
            : 'Search for a place, or tap the map to select its location'}
      </p>
    </div>
  )
}
