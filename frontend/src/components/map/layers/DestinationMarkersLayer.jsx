import { useEffect, useRef } from 'react';
import { useDestinationsStore } from '../../../store/useDestinationsStore';
import { clearMarkers } from './markerIcons';

/**
 * DestinationMarkersLayer - Renders map markers for all 36 tracked destinations across India.
 * Always active by default so the initial India map view displays destination pointers.
 *
 * Props:
 * - map: google.maps.Map instance
 * - mapsSDK: google.maps namespace
 * - selectedDestId: string ID of currently selected destination
 * - onSelectDestination: function(destId) callback when a destination pointer is clicked
 */
export default function DestinationMarkersLayer({ map, mapsSDK, selectedDestId, highlightedDestId, onSelectDestination }) {
  const markersRef = useRef([]);
  const infoWindowRef = useRef(null);
  const destinations = useDestinationsStore((state) => state.destinations);
  const fetchDestinations = useDestinationsStore((state) => state.fetchDestinations);

  useEffect(() => {
    fetchDestinations().catch((err) => console.error('[DestinationMarkersLayer] Error loading destinations:', err));
  }, [fetchDestinations]);

  // Step 2: Render markers for all 36 destinations
  useEffect(() => {
    if (!map || !mapsSDK || destinations.length === 0) return;

    if (!infoWindowRef.current) {
      infoWindowRef.current = new mapsSDK.InfoWindow();
    }

    clearMarkers(markersRef);

    const hasAdvanced = mapsSDK.marker && typeof mapsSDK.marker.AdvancedMarkerElement === 'function';

    destinations.forEach((dest) => {
      const lat = dest.location?.lat;
      const lng = dest.location?.lng;
      if (!lat || !lng) return;

      const isSelected = (dest._id || dest.id) === selectedDestId;
      const isHighlighted = (dest._id || dest.id) === highlightedDestId;

      // Custom SVG Pin with Lucide MapPin shape for Destination Pointer
      const pinColor = isSelected ? '#4F46E5' : isHighlighted ? '#059669' : '#E11D48'; // Indigo selected, emerald preview, rose default
      const svgPin = `
        <svg width="20" height="26" viewBox="0 0 24 28" fill="none" xmlns="http://www.w3.org/2000/svg">
          <filter id="sd" x="0" y="0" width="24" height="28" filterUnits="userSpaceOnUse">
            <feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="#000000" flood-opacity="0.35"/>
          </filter>
          <g filter="url(#sd)">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" fill="${pinColor}" stroke="white" stroke-width="2"/>
            <circle cx="12" cy="10" r="3.5" fill="white"/>
          </g>
        </svg>
      `.trim();
      const iconUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgPin)}`;

      let marker;
      const openInfoWindow = () => {
        const contentString = `
          <div style="padding:10px; max-width:230px; font-family:sans-serif;">
            <div style="font-size:10px; font-weight:700; color:#6366F1; text-transform:uppercase; margin-bottom:4px;">
              📍 Destination
            </div>
            <h4 style="margin:0 0 4px 0; font-size:14px; font-weight:700; color:#0F172A;">${dest.displayName || dest.name}</h4>
            <div style="font-size:12px; color:#64748B; margin-bottom:8px;">
              State: <strong>${dest.state || 'India'}</strong>
            </div>
            <button
              id="select-dest-btn-${dest._id || dest.id}"
              style="width:100%; padding:6px 12px; font-size:12px; font-weight:600; color:white; background-color:#4F46E5; border:none; border-radius:6px; cursor:pointer;"
            >
              Select Destination
            </button>
          </div>
        `;

        infoWindowRef.current.setContent(contentString);
        infoWindowRef.current.open(map, marker);

        // Attach listener for Select Destination button inside InfoWindow
        setTimeout(() => {
          const btn = document.getElementById(`select-dest-btn-${dest._id || dest.id}`);
          if (btn) {
            btn.onclick = () => {
              if (typeof onSelectDestination === 'function') {
                onSelectDestination(dest._id || dest.id);
              }
              infoWindowRef.current.close();
            };
          }
        }, 100);
      };

      if (hasAdvanced) {
        const img = document.createElement('img');
        img.src = iconUrl;
        img.width = 20;
        img.height = 26;
        img.style.cursor = 'pointer';

        marker = new mapsSDK.marker.AdvancedMarkerElement({
          position: { lat, lng },
          map,
          title: dest.displayName,
          content: img
        });

        marker.addEventListener('gmp-click', openInfoWindow);
        img.addEventListener('click', openInfoWindow);
      } else {
        marker = new mapsSDK.Marker({
          position: { lat, lng },
          map,
          title: dest.displayName,
          icon: {
            url: iconUrl,
            scaledSize: new mapsSDK.Size(20, 26),
            anchor: new mapsSDK.Point(10, 26)
          }
        });

        marker.addListener('click', openInfoWindow);
      }

      markersRef.current.push(marker);
    });

    return () => {
      clearMarkers(markersRef);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, mapsSDK, destinations, selectedDestId]);

  return null;
}
