import { useEffect, useRef } from 'react';

/**
 * Decodes Google Routes API / Polyline encoded string into array of {lat, lng} objects.
 * Pure JS implementation -- does not rely on external SDK libraries.
 */
function decodePolyline(encoded) {
  if (!encoded) return [];
  const poly = [];
  let index = 0, len = encoded.length;
  let lat = 0, lng = 0;

  while (index < len) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    poly.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return poly;
}

/**
 * RoutePolylineLayer - Renders turn-by-turn on-road polylines and directions on Google Maps canvas.
 * Decodes encoded polylines from Google Routes API or uses DirectionsRenderer / direct fallback lines.
 */
export default function RoutePolylineLayer({ map, mapsSDK, routeData }) {
  const directionsRendererRef = useRef(null);
  const customPolylineRef = useRef(null);
  const startMarkerRef = useRef(null);
  const endMarkerRef = useRef(null);

  // Helper to clear existing layer elements
  const clearLayer = () => {
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setMap(null);
      directionsRendererRef.current = null;
    }
    if (customPolylineRef.current) {
      customPolylineRef.current.setMap(null);
      customPolylineRef.current = null;
    }
    if (startMarkerRef.current) {
      if (typeof startMarkerRef.current.setMap === 'function') startMarkerRef.current.setMap(null);
      else startMarkerRef.current.map = null;
      startMarkerRef.current = null;
    }
    if (endMarkerRef.current) {
      if (typeof endMarkerRef.current.setMap === 'function') endMarkerRef.current.setMap(null);
      else endMarkerRef.current.map = null;
      endMarkerRef.current = null;
    }
  };

  useEffect(() => {
    if (routeData?.isEstimated || routeData?.isUnavailable) {
      clearLayer();
      return;
    }
    if (!map || !mapsSDK || !routeData?.originCoords || !routeData?.destCoords) {
      clearLayer();
      return;
    }

    clearLayer();

    const { originCoords, destCoords, polyline: encodedPolyline, travelMode = 'DRIVE', sourceName, destName } = routeData;

    const isFlight = travelMode === 'FLIGHT';
    const isTrain = travelMode === 'TRAIN';
    const modeColor = isFlight ? '#0284C7' : isTrain ? '#7C3AED' : '#4F46E5';

    const bounds = new mapsSDK.LatLngBounds();
    bounds.extend(originCoords);
    bounds.extend(destCoords);

    // 1. Render Lucide SVG Start Marker (Source - Emerald Green Pin)
    const startSvg = `
      <svg width="28" height="34" viewBox="0 0 24 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <filter id="sd_s" x="-2" y="-1" width="28" height="32" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="#000000" flood-opacity="0.4"/>
        </filter>
        <g filter="url(#sd_s)">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" fill="#10B981" stroke="white" stroke-width="2"/>
          <circle cx="12" cy="10" r="3.5" fill="white"/>
        </g>
      </svg>
    `.trim();
    const startIconUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(startSvg)}`;

    // 2. Render Lucide SVG End Marker (Destination - Indigo Pin)
    const endSvg = `
      <svg width="28" height="34" viewBox="0 0 24 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <filter id="sd_e" x="-2" y="-1" width="28" height="32" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="#000000" flood-opacity="0.4"/>
        </filter>
        <g filter="url(#sd_e)">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" fill="#4F46E5" stroke="white" stroke-width="2"/>
          <circle cx="12" cy="10" r="3.5" fill="white"/>
        </g>
      </svg>
    `.trim();
    const endIconUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(endSvg)}`;

    const hasAdvanced = mapsSDK.marker && typeof mapsSDK.marker.AdvancedMarkerElement === 'function';

    if (hasAdvanced) {
      const sImg = document.createElement('img');
      sImg.src = startIconUrl;
      sImg.width = 28;
      sImg.height = 34;

      startMarkerRef.current = new mapsSDK.marker.AdvancedMarkerElement({
        position: originCoords,
        map,
        title: `Start: ${sourceName || 'Origin'}`,
        content: sImg
      });

      const eImg = document.createElement('img');
      eImg.src = endIconUrl;
      eImg.width = 28;
      eImg.height = 34;

      endMarkerRef.current = new mapsSDK.marker.AdvancedMarkerElement({
        position: destCoords,
        map,
        title: `Destination: ${destName || 'Destination'}`,
        content: eImg
      });
    } else {
      startMarkerRef.current = new mapsSDK.Marker({
        position: originCoords,
        map,
        title: `Start: ${sourceName || 'Origin'}`,
        icon: {
          url: startIconUrl,
          scaledSize: new mapsSDK.Size(28, 34),
          anchor: new mapsSDK.Point(14, 34)
        }
      });

      endMarkerRef.current = new mapsSDK.Marker({
        position: destCoords,
        map,
        title: `Destination: ${destName || 'Destination'}`,
        icon: {
          url: endIconUrl,
          scaledSize: new mapsSDK.Size(28, 34),
          anchor: new mapsSDK.Point(14, 34)
        }
      });
    }

    // 3. Decode turn-by-turn on-road polyline from Google Routes API v2
    let decodedPath = [];
    if (encodedPolyline) {
      try {
        decodedPath = decodePolyline(encodedPolyline);
        if (decodedPath.length > 0) {
          const polyline = new mapsSDK.Polyline({
            path: decodedPath,
            geodesic: true,
            strokeColor: modeColor,
            strokeOpacity: 0.85,
            strokeWeight: 5,
            map,
          });

          customPolylineRef.current = polyline;
          decodedPath.forEach((point) => bounds.extend(point));
        }
      } catch (err) {
        console.warn('[RoutePolylineLayer] Polyline decoding failed:', err);
      }
    }

    // Fallback if no encoded polyline or straight line mode (Flight/Train)
    if (decodedPath.length === 0) {
      const polyline = new mapsSDK.Polyline({
        path: [originCoords, destCoords],
        geodesic: true,
        strokeColor: modeColor,
        strokeOpacity: 0.85,
        strokeWeight: 4,
        icons: isFlight || isTrain ? [
          {
            icon: {
              path: 'M 0,-1 0,1',
              strokeOpacity: 1,
              scale: 3
            },
            offset: '0',
            repeat: '15px'
          }
        ] : [],
        map,
      });

      customPolylineRef.current = polyline;
    }

    // 4. Zoom map tightly between Source and Destination (below floating header controls)
    if (map && typeof map.fitBounds === 'function') {
      map.fitBounds(bounds, { top: 180, bottom: 120, left: 80, right: 80 });
    }

    return () => {
      clearLayer();
    };
  }, [map, mapsSDK, routeData]);

  return null;
}
