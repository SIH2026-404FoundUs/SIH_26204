import { useEffect, useMemo, useRef, useState } from 'react'
import { Images, Loader2, MapPin } from 'lucide-react'
import { loadGoogleMaps } from '../../../lib/googleMapsLoader'
import { API_BASE } from '../../../lib/api'

function resolvePhotoUrl(value) {
  if (!value) return ''
  if (value.startsWith('http')) return value
  return value.startsWith('/api/') ? `${API_BASE}${value.slice(4)}` : value
}

function collectPlaces(destination, stays, itineraryDays) {
  const places = []
  const add = (place, type) => {
    if (!place || !place.name || !place.placeId) return
    const photoValues = [
      place.photoUrl,
      ...(Array.isArray(place.photoUrls) ? place.photoUrls : []),
      ...(Array.isArray(place.photos) ? place.photos : []),
    ].map(resolvePhotoUrl).filter(Boolean)
    if (!photoValues.length) return
    const id = `${type}-${place.placeId}-${place.name}`
    // The same stop can appear on several itinerary days; list it once.
    if (places.some((existing) => existing.id === id)) return
    places.push({
      id,
      name: place.name,
      type,
      placeId: place.placeId,
      photos: [...new Set(photoValues)].slice(0, 6),
    })
  }

  stays.forEach((stay) => add(stay, 'Hotel'))
  itineraryDays.forEach((day) => (day?.stops || []).forEach((stop) => {
    const location = stop?.location && typeof stop.location === 'object' ? { ...stop.location, ...stop } : stop
    add(location, 'Attraction')
  }))
  if (destination?.photoUrl && destination?.googlePlaceId) add(destination, 'Destination')
  return places
}

export default function TripExperiencePanel({ destination, stays = [], itineraryDays = [] }) {
  const streetViewRef = useRef(null)
  const panoramaRef = useRef(null)
  const [streetViewState, setStreetViewState] = useState('loading')
  const [selectedPlaceId, setSelectedPlaceId] = useState('all')
  const places = useMemo(() => collectPlaces(destination, stays, itineraryDays), [destination, stays, itineraryDays])
  const galleryPhotos = useMemo(() => {
    const source = selectedPlaceId === 'all' ? places : places.filter((place) => place.id === selectedPlaceId)
    return source.flatMap((place) => place.photos.map((url) => ({ ...place, url }))).slice(0, 6)
  }, [places, selectedPlaceId])

  useEffect(() => {
    let active = true
    if (!streetViewRef.current || !destination?.location?.lat || !destination?.location?.lng) {
      setStreetViewState('unavailable')
      return undefined
    }
    setStreetViewState('loading')
    loadGoogleMaps()
      .then((maps) => {
        if (!active || !streetViewRef.current || !maps?.StreetViewService || !maps?.StreetViewPanorama) return
        const location = { lat: Number(destination.location.lat), lng: Number(destination.location.lng) }
        const service = new maps.StreetViewService()
        service.getPanorama({
          location,
          radius: 1500,
          source: maps.StreetViewSource?.OUTDOOR,
        }, (data, status) => {
          if (!active || !streetViewRef.current) return
          if (status !== maps.StreetViewStatus.OK || !data?.location?.pano) {
            setStreetViewState('unavailable')
            return
          }
          panoramaRef.current = new maps.StreetViewPanorama(streetViewRef.current, {
            pano: data.location.pano,
            pov: { heading: 0, pitch: 0 },
            zoom: 1,
            addressControl: false,
            fullscreenControl: true,
            motionTrackingControl: false,
            linksControl: true,
          })
          setStreetViewState('ready')
        })
      })
      .catch(() => { if (active) setStreetViewState('unavailable') })

    return () => {
      active = false
      panoramaRef.current?.setVisible(false)
      panoramaRef.current = null
    }
  }, [destination?.location?.lat, destination?.location?.lng])

  return (
    <section className="mt-4 space-y-3 rounded-2xl border border-white/70 bg-white/70 p-3 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><MapPin size={15} /></div>
        <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-indigo-500">See the destination</p><h3 className="text-sm font-extrabold text-slate-900">Street View and trip gallery</h3></div>
      </div>

      <div className="relative h-36 overflow-hidden rounded-xl bg-slate-100">
        <div ref={streetViewRef} className="h-full w-full" aria-label={`Street View of ${destination?.displayName || 'the destination'}`} />
        {streetViewState === 'loading' && <div className="absolute inset-0 flex items-center justify-center gap-2 bg-slate-100 text-xs font-semibold text-slate-500"><Loader2 size={14} className="animate-spin" /> Loading Street View...</div>}
        {streetViewState === 'unavailable' && <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-slate-100 px-4 text-center text-xs text-slate-500"><MapPin size={16} className="text-slate-400" /><span>Street View is not available at this destination.</span></div>}
      </div>

      {places.length > 0 && <>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button type="button" onClick={() => setSelectedPlaceId('all')} className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-bold ${selectedPlaceId === 'all' ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600'}`}>All places</button>
          {places.map((place) => <button key={place.id} type="button" onClick={() => setSelectedPlaceId(place.id)} className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-bold ${selectedPlaceId === place.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{place.type}: {place.name}</button>)}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {galleryPhotos.map((photo, index) => <figure key={`${photo.id}-${photo.url}-${index}`} className="min-w-[122px] overflow-hidden rounded-xl border border-slate-200 bg-white">
            <img src={photo.url} alt={photo.name} className="h-20 w-full object-cover" loading="lazy" />
            <figcaption className="truncate px-2 py-1.5 text-[10px] font-semibold text-slate-700">{photo.name}</figcaption>
          </figure>)}
          {!galleryPhotos.length && <p className="flex items-center gap-1 text-[11px] text-slate-500"><Images size={13} /> No stored photos for this place yet.</p>}
        </div>
      </>}
      {!places.length && <p className="text-[11px] text-slate-500">Stored Google Places photos will appear here when available.</p>}
    </section>
  )
}
