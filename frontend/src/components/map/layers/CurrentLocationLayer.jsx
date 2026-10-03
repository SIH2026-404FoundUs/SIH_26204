import { useEffect, useRef } from 'react'

/** Renders the browser's live position and accuracy radius on the map. */
export default function CurrentLocationLayer({ map, mapsSDK, location }) {
  const markerRef = useRef(null)
  const accuracyRef = useRef(null)

  useEffect(() => {
    if (!map || !mapsSDK || !location) return undefined

    const position = { lat: location.lat, lng: location.lng }
    const icon = {
      path: mapsSDK.SymbolPath.CIRCLE,
      scale: 8,
      fillColor: '#2563EB',
      fillOpacity: 1,
      strokeColor: '#FFFFFF',
      strokeWeight: 3,
    }

    if (!markerRef.current) {
      markerRef.current = new mapsSDK.Marker({
        map,
        position,
        title: 'Your current location',
        icon,
        zIndex: 1000,
      })
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
    markerRef.current?.setMap(null)
    accuracyRef.current?.setMap(null)
    markerRef.current = null
    accuracyRef.current = null
  }, [])

  return null
}
