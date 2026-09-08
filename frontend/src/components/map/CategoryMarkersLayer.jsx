import { useEffect, useRef } from 'react';
import api from '../../lib/api';
import { getCategoryMarkerIconSvg, CATEGORY_STYLES } from './markerIcons';

/**
 * CategoryMarkersLayer - Renders category-specific markers on the Google Map.
 * Uses `google.maps.marker.AdvancedMarkerElement` with fallback to legacy `google.maps.Marker`.
 * Grouped into Stays (🏨), Food (🍱), Attractions (🏔️), Transport (🚌), and Local Services (🛠️).
 *
 * Props:
 * - map: google.maps.Map instance
 * - mapsSDK: google.maps namespace
 * - destId: string destination ID (e.g., 'manali')
 * - visibleCategories: { stays: boolean, food: boolean, attractions: boolean, transport: boolean, localServices: boolean }
 */
export default function CategoryMarkersLayer({
  map,
  mapsSDK,
  destId = 'manali',
  visibleCategories = { stays: true, food: true, attractions: true, transport: true, localServices: true }
}) {
  const markersRef = useRef([]);
  const infoWindowRef = useRef(null);

  // Helper to clear existing markers (handles both Marker and AdvancedMarkerElement)
  const clearMarkers = () => {
    markersRef.current.forEach((m) => {
      if (m) {
        if (typeof m.setMap === 'function') {
          m.setMap(null);
        } else {
          m.map = null;
        }
      }
    });
    markersRef.current = [];
  };

  useEffect(() => {
    if (!map || !mapsSDK || !destId) return;

    let isMounted = true;

    if (!infoWindowRef.current) {
      infoWindowRef.current = new mapsSDK.InfoWindow();
    }

    // Step 1: Fetch destination center and businesses for destId
    Promise.all([
      api.get('/destinations').catch(() => ({ data: [] })),
      api.get(`/v1/businesses/search?destId=${destId}`).catch(() => ({ data: [] }))
    ]).then(([destsRes, bizRes]) => {
      if (!isMounted) return;

      clearMarkers();

      const dests = destsRes.data?.data || destsRes.data || [];
      const currentDest = dests.find((d) => (d._id || d.id) === destId) || dests[0];
      const baseLat = currentDest?.location?.lat || 32.2432;
      const baseLng = currentDest?.location?.lng || 77.1892;

      const rawBusinesses = Array.isArray(bizRes.data) ? bizRes.data : [];

      // Category Map Definition
      const categoryMap = {
        stays: [
          ...rawBusinesses.filter((b) => ['homestay', 'guesthouse', 'hotel', 'stay'].includes(b.type?.toLowerCase())),
          { _id: 'stay_1', name: `${currentDest?.displayName || destId} Heritage Stay`, type: 'homestay', capacity: 12, price: '₹1,200 - ₹2,500', lat: baseLat + 0.008, lng: baseLng + 0.006 },
          { _id: 'stay_2', name: 'Alpine Eco Guesthouse', type: 'guesthouse', capacity: 8, price: '₹1,500 - ₹3,000', lat: baseLat - 0.006, lng: baseLng - 0.008 }
        ],
        food: [
          ...rawBusinesses.filter((b) => ['food', 'restaurant', 'cafe', 'dining'].includes(b.type?.toLowerCase())),
          { _id: 'food_1', name: 'Local Flavours & Cafe', type: 'food', capacity: 25, price: '₹300 - ₹800', lat: baseLat + 0.004, lng: baseLng - 0.007 },
          { _id: 'food_2', name: 'Valley Organic Bistro', type: 'food', capacity: 18, price: '₹400 - ₹900', lat: baseLat - 0.009, lng: baseLng + 0.005 }
        ],
        attractions: [
          ...rawBusinesses.filter((b) => ['attractions', 'sightseeing', 'viewpoint'].includes(b.type?.toLowerCase())),
          { _id: 'attr_1', name: `${currentDest?.displayName || destId} Central Viewpoint`, type: 'attractions', capacity: 150, price: 'Free Entry', lat: baseLat + 0.012, lng: baseLng + 0.011 },
          { _id: 'attr_2', name: 'Ancient Temple & Heritage Site', type: 'attractions', capacity: 100, price: 'Free Entry', lat: baseLat - 0.011, lng: baseLng + 0.009 }
        ],
        transport: [
          ...rawBusinesses.filter((b) => ['transport', 'bus', 'taxi'].includes(b.type?.toLowerCase())),
          { _id: 'trans_1', name: 'Local Tourist Bus Stand & Taxi Hub', type: 'transport', capacity: 50, price: 'Standard Tariff', lat: baseLat - 0.003, lng: baseLng + 0.004 }
        ],
        localServices: [
          ...rawBusinesses.filter((b) => ['localservices', 'guide', 'artisan'].includes(b.type?.toLowerCase())),
          { _id: 'serv_1', name: 'Certified Local Guides & Craft Center', type: 'localServices', capacity: 15, price: '₹500 / day', lat: baseLat + 0.007, lng: baseLng - 0.004 }
        ]
      };

      const bounds = new mapsSDK.LatLngBounds();
      let totalMarkers = 0;
      const hasAdvancedMarkers = mapsSDK.marker && typeof mapsSDK.marker.AdvancedMarkerElement === 'function';

      // Step 2: Render markers for visible categories
      Object.keys(categoryMap).forEach((categoryKey) => {
        if (!visibleCategories[categoryKey]) return;

        const style = CATEGORY_STYLES[categoryKey];
        const items = categoryMap[categoryKey];

        items.forEach((item, index) => {
          const lat = item.lat || (item.location?.lat ?? baseLat + (index * 0.004 - 0.008));
          const lng = item.lng || (item.location?.lng ?? baseLng + (index * 0.005 - 0.009));

          const iconUrl = getCategoryMarkerIconSvg(categoryKey);

          let marker;
          const openInfoWindow = () => {
            const contentString = `
              <div style="padding:10px; max-width:220px; font-family:sans-serif;">
                <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px;">
                  <span style="font-size:16px;">${style.emoji}</span>
                  <span style="font-size:11px; font-weight:700; color:${style.bg}; text-transform:uppercase;">${style.label}</span>
                </div>
                <h4 style="margin:0 0 4px 0; font-size:14px; font-weight:700; color:#0F172A;">${item.name}</h4>
                <div style="font-size:12px; color:#475569; margin-bottom:4px;">
                  <strong>Capacity:</strong> ${item.capacity ?? 'Available'}
                </div>
                <div style="font-size:12px; color:#475569;">
                  <strong>Price:</strong> ${item.price || (item.priceRangeINR ? `₹${item.priceRangeINR.min} - ₹${item.priceRangeINR.max}` : 'Standard')}
                </div>
              </div>
            `;
            infoWindowRef.current.setContent(contentString);
            infoWindowRef.current.open(map, marker);
          };

          if (hasAdvancedMarkers) {
            const img = document.createElement('img');
            img.src = iconUrl;
            img.width = 34;
            img.height = 40;
            img.style.cursor = 'pointer';

            marker = new mapsSDK.marker.AdvancedMarkerElement({
              position: { lat, lng },
              map,
              title: item.name,
              content: img
            });

            marker.addListener('gmp-click', openInfoWindow);
            img.addEventListener('click', openInfoWindow);
          } else {
            marker = new mapsSDK.Marker({
              position: { lat, lng },
              map,
              title: item.name,
              icon: {
                url: iconUrl,
                scaledSize: new mapsSDK.Size(34, 40),
                anchor: new mapsSDK.Point(17, 40)
              }
            });

            marker.addListener('click', openInfoWindow);
          }

          bounds.extend({ lat, lng });
          totalMarkers++;
          markersRef.current.push(marker);
        });
      });

      // Fit map bounds to encompass all visible markers
      if (totalMarkers > 0 && map && typeof map.fitBounds === 'function') {
        map.fitBounds(bounds);
      }
    }).catch((err) => {
      console.error('[CategoryMarkersLayer] Error rendering markers:', err);
    });

    return () => {
      isMounted = false;
      clearMarkers();
    };
  }, [map, mapsSDK, destId, visibleCategories]);

  return null;
}
