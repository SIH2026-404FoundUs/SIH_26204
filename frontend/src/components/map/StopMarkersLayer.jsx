import { useEffect, useRef } from 'react'

export default function StopMarkersLayer({ map, mapsSDK, stops = [] }) {
  const markersRef = useRef([])
  useEffect(() => {
    if (!map || !mapsSDK) return undefined
    markersRef.current.forEach((marker) => marker?.setMap?.(null))
    markersRef.current = []
    stops.forEach((stop, index) => {
      if (!Number.isFinite(Number(stop.lat)) || !Number.isFinite(Number(stop.lng))) return
      const marker = new mapsSDK.Marker({
        map,
        position: { lat: Number(stop.lat), lng: Number(stop.lng) },
        title: `Stop ${index + 1}: ${stop.name || 'Custom stop'}`,
        label: { text: String(index + 1), color: '#FFFFFF', fontWeight: '700' },
        icon: { path: mapsSDK.SymbolPath.CIRCLE, scale: 12, fillColor: '#6C63FF', fillOpacity: 1, strokeColor: '#FFFFFF', strokeWeight: 3 },
        zIndex: 800,
      })
      markersRef.current.push(marker)
    })
    return () => {
      markersRef.current.forEach((marker) => marker?.setMap?.(null))
      markersRef.current = []
    }
  }, [map, mapsSDK, stops])
  return null
}
