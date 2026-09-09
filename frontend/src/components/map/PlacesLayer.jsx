import { useEffect, useRef } from 'react';
import api from '../../lib/api';

/**
 * PlacesLayer - Fetches and renders nearby Hotels (🏨) and Restaurants (🍽️) on the Google Map.
 * Uses backend `GET /api/places` (Google Places API provider).
 * Clicking a marker opens an InfoWindow with name, rating, address, and interactive buttons:
 * - "Select Hotel" (for lodging)
 * - "Add as Stop" (adds location to trip stops)
 *
 * Props:
 * - map: google.maps.Map instance
 * - mapsSDK: google.maps namespace
 * - center: { lat, lng } base center coordinates
 * - visiblePlaces: { hotels: boolean, restaurants: boolean }
 * - onSelectHotel: function(hotelObj)
 * - onAddStop: function(stopObj)
 */
export default function PlacesLayer({
  map,
  mapsSDK,
  center = { lat: 32.2432, lng: 77.1892 },
  visiblePlaces = { hotels: false, restaurants: false },
  onSelectHotel,
  onAddStop
}) {
  const markersRef = useRef([]);
  const infoWindowRef = useRef(null);

  const clearMarkers = () => {
    markersRef.current.forEach((m) => {
      if (m) {
        if (typeof m.setMap === 'function') m.setMap(null);
        else m.map = null;
      }
    });
    markersRef.current = [];
  };

  useEffect(() => {
    if (!map || !mapsSDK || !center?.lat || !center?.lng) return;
    if (!visiblePlaces.hotels && !visiblePlaces.restaurants) {
      clearMarkers();
      return;
    }

    let isMounted = true;

    if (!infoWindowRef.current) {
      infoWindowRef.current = new mapsSDK.InfoWindow();
    }

    const fetches = [];
    if (visiblePlaces.hotels) {
      fetches.push(
        api.get('/places', { params: { query: 'hotel', lat: center.lat, lng: center.lng, radiusMeters: 5000 } })
          .then((res) => (res.data?.ok ? res.data.data.map((p) => ({ ...p, placeType: 'hotel' })) : []))
          .catch(() => [])
      );
    }
    if (visiblePlaces.restaurants) {
      fetches.push(
        api.get('/places', { params: { query: 'restaurant', lat: center.lat, lng: center.lng, radiusMeters: 5000 } })
          .then((res) => (res.data?.ok ? res.data.data.map((p) => ({ ...p, placeType: 'restaurant' })) : []))
          .catch(() => [])
      );
    }

    Promise.all(fetches).then((results) => {
      if (!isMounted) return;
      clearMarkers();

      const allPlaces = results.flat();
      const hasAdvanced = mapsSDK.marker && typeof mapsSDK.marker.AdvancedMarkerElement === 'function';

      allPlaces.forEach((place, idx) => {
        const lat = place.lat;
        const lng = place.lng;
        if (!lat || !lng) return;

        const isHotel = place.placeType === 'hotel';
        const color = isHotel ? '#4F46E5' : '#D97706'; // Indigo for hotel, Amber for restaurant

        // Custom SVG pin for Places
        const svgPin = `
          <svg width="24" height="28" viewBox="0 0 24 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <filter id="sd_p_${idx}" x="-2" y="-1" width="28" height="32" filterUnits="userSpaceOnUse">
              <feDropShadow dx="0" dy="1.5" stdDeviation="1.2" flood-color="#000000" flood-opacity="0.35"/>
            </filter>
            <g filter="url(#sd_p_${idx})">
              <path d="M12 0C5.37 0 0 5.37 0 12C0 19 12 26 12 26C12 26 24 19 24 12C24 5.37 18.63 0 12 0Z" fill="${color}" stroke="#ffffff" stroke-width="1.2"/>
              <circle cx="12" cy="11" r="5" fill="#ffffff"/>
            </g>
          </svg>
        `.trim();
        const iconUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgPin)}`;

        let marker;
        const openInfoWindow = () => {
          const badgeLabel = isHotel ? '🏨 Hotel' : '🍽️ Restaurant';
          const badgeBg = isHotel ? '#4F46E5' : '#D97706';
          const contentString = `
            <div style="padding:10px; max-width:230px; font-family:system-ui, -apple-system, sans-serif;">
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
                <span style="font-size:10px; font-weight:700; color:${badgeBg}; background:${badgeBg}18; padding:3px 8px; border-radius:12px; text-transform:uppercase;">
                  ${badgeLabel}
                </span>
                ${place.rating ? `<span style="font-size:11px; font-weight:700; color:#D97706;">★ ${place.rating}</span>` : ''}
              </div>
              <h4 style="margin:0 0 4px 0; font-size:14px; font-weight:700; color:#0F172A;">${place.name}</h4>
              <p style="margin:0 0 8px 0; font-size:11px; color:#64748B;">Near ${center.lat.toFixed(2)}, ${center.lng.toFixed(2)}</p>
              <div style="display:flex; flex-direction:column; gap:6px;">
                ${isHotel ? `
                  <button id="select-hotel-btn-${idx}" style="width:100%; padding:6px 10px; font-size:11px; font-weight:700; color:white; background:#4F46E5; border:none; border-radius:6px; cursor:pointer;">
                    🏨 Select Hotel
                  </button>
                ` : ''}
                <button id="add-stop-btn-${idx}" style="width:100%; padding:6px 10px; font-size:11px; font-weight:700; color:#1E293B; background:#F1F5F9; border:1px solid #CBD5E1; border-radius:6px; cursor:pointer;">
                  📍 Add as Stop
                </button>
              </div>
            </div>
          `;

          infoWindowRef.current.setContent(contentString);
          infoWindowRef.current.open(map, marker);

          setTimeout(() => {
            const hotelBtn = document.getElementById(`select-hotel-btn-${idx}`);
            if (hotelBtn) {
              hotelBtn.onclick = () => {
                if (typeof onSelectHotel === 'function') {
                  onSelectHotel({ name: place.name, placeId: place.placeId, lat, lng, rating: place.rating });
                }
                infoWindowRef.current.close();
              };
            }
            const stopBtn = document.getElementById(`add-stop-btn-${idx}`);
            if (stopBtn) {
              stopBtn.onclick = () => {
                if (typeof onAddStop === 'function') {
                  onAddStop({ name: place.name, lat, lng, type: isHotel ? 'hotel' : 'restaurant' });
                }
                infoWindowRef.current.close();
              };
            }
          }, 100);
        };

        if (hasAdvanced) {
          const img = document.createElement('img');
          img.src = iconUrl;
          img.width = 24;
          img.height = 28;
          img.style.cursor = 'pointer';

          marker = new mapsSDK.marker.AdvancedMarkerElement({
            position: { lat, lng },
            map,
            title: place.name,
            content: img
          });

          marker.addListener('gmp-click', openInfoWindow);
          img.addEventListener('click', openInfoWindow);
        } else {
          marker = new mapsSDK.Marker({
            position: { lat, lng },
            map,
            title: place.name,
            icon: {
              url: iconUrl,
              scaledSize: new mapsSDK.Size(24, 28),
              anchor: new mapsSDK.Point(12, 28)
            }
          });
          marker.addListener('click', openInfoWindow);
        }

        markersRef.current.push(marker);
      });
    });

    return () => {
      isMounted = false;
      clearMarkers();
    };
  }, [map, mapsSDK, center, visiblePlaces]);

  return null;
}
