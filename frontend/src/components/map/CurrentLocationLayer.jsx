import { useEffect, useRef } from 'react'

/** Renders the browser's live position and accuracy radius on the map. */
export default function CurrentLocationLayer({ map, mapsSDK, location }) {
  const markerRef = useRef(null)
  const accuracyRef = useRef(null)

  useEffect(() => {
    if (!map || !mapsSDK || !location) return undefined

    const position = { lat: location.lat, lng: location.lng }
    const hasAdvanced = mapsSDK.marker && typeof mapsSDK.marker.AdvancedMarkerElement === 'function'

    if (!markerRef.current) {
      if (hasAdvanced) {
        const content = document.createElement('div')
        content.style.cssText = 'width:16px;height:16px;border-radius:50%;background:#2563EB;border:3px solid #FFFFFF;box-shadow:0 1px 3px rgba(0,0,0,0.4);'
        markerRef.current = new mapsSDK.marker.AdvancedMarkerElement({
          map,
          position,
          title: 'Your current location',
          content,
          zIndex: 1000,
        })
      } else {
        markerRef.current = new mapsSDK.Marker({
          map,
          position,
          title: 'Your current location',
          icon: {
            path: mapsSDK.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#2563EB',
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 3,
          },
          zIndex: 1000,
        })
      }
    } else if (hasAdvanced) {
      markerRef.current.position = position
    } else {
      markerRef.current.setPosition(position)
    }

    if (!accuracyRef.current) {
      accuracyRef.current = new mapsSDK.Circle({
        map,
        center: position,
        radius: Math.max(Number(location.accuracy) || 0, 20),
        fillColor: '#2563EB',
        fillOpacity: 0.12,
        strokeColor: '#2563EB',
        strokeOpacity: 0.35,
        strokeWeight: 1,
        clickable: false,
        zIndex: 999,
      })
    } else {
      accuracyRef.current.setCenter(position)
      accuracyRef.current.setRadius(Math.max(Number(location.accuracy) || 0, 20))
    }

    return undefined
  }, [map, mapsSDK, location])

  useEffect(() => () => {
    if (markerRef.current) {
      if (typeof markerRef.current.setMap === 'function') markerRef.current.setMap(null)
      else markerRef.current.map = null
    }
    accuracyRef.current?.setMap(null)
    markerRef.current = null
    accuracyRef.current = null
  }, [])

  return null
}
