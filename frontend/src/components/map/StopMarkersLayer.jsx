import { useEffect, useRef } from 'react'

function removeMarker(marker) {
  if (!marker) return
  if (typeof marker.setMap === 'function') marker.setMap(null)
  else marker.map = null
}

export default function StopMarkersLayer({ map, mapsSDK, stops = [] }) {
  const markersRef = useRef([])
  useEffect(() => {
    if (!map || !mapsSDK) return undefined
    markersRef.current.forEach(removeMarker)
    markersRef.current = []
    const hasAdvanced = mapsSDK.marker && typeof mapsSDK.marker.AdvancedMarkerElement === 'function'
    stops.forEach((stop, index) => {
      if (!Number.isFinite(Number(stop.lat)) || !Number.isFinite(Number(stop.lng))) return
      const position = { lat: Number(stop.lat), lng: Number(stop.lng) }
      const title = `Stop ${index + 1}: ${stop.name || 'Custom stop'}`
      let marker
      if (hasAdvanced) {
        const content = document.createElement('div')
        content.style.cssText = 'display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:#6C63FF;border:3px solid #FFFFFF;color:#FFFFFF;font-size:11px;font-weight:700;box-shadow:0 1px 3px rgba(0,0,0,0.3);'
        content.textContent = String(index + 1)
        marker = new mapsSDK.marker.AdvancedMarkerElement({ map, position, title, content, zIndex: 800 })
      } else {
        marker = new mapsSDK.Marker({
          map,
          position,
          title,
          label: { text: String(index + 1), color: '#FFFFFF', fontWeight: '700' },
          icon: { path: mapsSDK.SymbolPath.CIRCLE, scale: 12, fillColor: '#6C63FF', fillOpacity: 1, strokeColor: '#FFFFFF', strokeWeight: 3 },
          zIndex: 800,
        })
      }
      markersRef.current.push(marker)
    })
    return () => {
      markersRef.current.forEach(removeMarker)
      markersRef.current = []
    }
  }, [map, mapsSDK, stops])
  return null
}
