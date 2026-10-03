import { useEffect, useRef } from 'react';
import api from '../../../lib/api';
import { useDestinationsStore } from '../../../store/useDestinationsStore';
import { getCategoryMarkerIconSvg, CATEGORY_STYLES, clearMarkers } from './markerIcons';

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
  const destinations = useDestinationsStore((state) => state.destinations);
  const fetchDestinations = useDestinationsStore((state) => state.fetchDestinations);

  useEffect(() => {
    if (!map || !mapsSDK || !destId) return;
    if (destinations.length === 0) {
      fetchDestinations().catch(() => {});
      return;
    }

    let isMounted = true;

    if (!infoWindowRef.current) {
      infoWindowRef.current = new mapsSDK.InfoWindow();
    }

    // Step 1: Fetch destination center and businesses for destId
    Promise.all([
      api.get(`/v1/businesses/search?destId=${destId}`).catch(() => ({ data: [] }))
    ]).then(([bizRes]) => {
      if (!isMounted) return;

      clearMarkers(markersRef);

      const currentDest = destinations.find((d) => (d._id || d.id) === destId) || destinations[0];
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
      // Render only businesses returned by the API. The old synthetic pins
      // made empty server results look like verified hotels, restaurants and
      // attractions on the map.
      const verifiedCategoryMap = Object.fromEntries(
        Object.entries(categoryMap).map(([key, items]) => [
          key,
          items.filter((item) => !String(item._id || '').match(/^(stay|food|attr|trans|serv)_/)),
        ])
      );

      const bounds = new mapsSDK.LatLngBounds();
      let totalMarkers = 0;
      const hasAdvancedMarkers = mapsSDK.marker && typeof mapsSDK.marker.AdvancedMarkerElement === 'function';

      // Step 2: Render markers for visible categories
      Object.keys(verifiedCategoryMap).forEach((categoryKey) => {
        if (!visibleCategories[categoryKey]) return;

        const style = CATEGORY_STYLES[categoryKey];
        const items = verifiedCategoryMap[categoryKey];

        items.forEach((item, index) => {
          const lat = item.lat || (item.location?.lat ?? baseLat + (index * 0.004 - 0.008));
          const lng = item.lng || (item.location?.lng ?? baseLng + (index * 0.005 - 0.009));

          const iconUrl = getCategoryMarkerIconSvg(categoryKey);

          let marker;
          const openInfoWindow = () => {
            const categoryLabel = style?.label || categoryKey.toUpperCase();
            const categoryColor = style?.bg || '#4F46E5';

            const contentString = `
              <div style="padding:10px; max-width:230px; font-family:system-ui, -apple-system, sans-serif;">
                <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px;">
                  <span style="font-size:10px; font-weight:700; color:${categoryColor}; background:${categoryColor}18; padding:3px 8px; border-radius:12px; text-transform:uppercase; letter-spacing:0.5px;">${categoryLabel}</span>
                </div>
                <h4 style="margin:0 0 6px 0; font-size:14px; font-weight:700; color:#0F172A;">${item.name || 'Tourist Spot'}</h4>
                <div style="font-size:12px; color:#475569; margin-bottom:4px;">
                  <strong>Capacity:</strong> ${item.capacity ?? 'Available'}
                </div>
                <div style="font-size:12px; color:#475569;">
                  <strong>Price:</strong> ${item.price || (item.priceRangeINR ? `₹${item.priceRangeINR.min} - ₹${item.priceRangeINR.max}` : 'Free Entry')}
                </div>
              </div>
            `;
            infoWindowRef.current.setContent(contentString);
            infoWindowRef.current.open(map, marker);
          };

          if (hasAdvancedMarkers) {
            const img = document.createElement('img');
            img.src = iconUrl;
            img.width = 26;
            img.height = 31;
            img.style.cursor = 'pointer';

            marker = new mapsSDK.marker.AdvancedMarkerElement({
              position: { lat, lng },
              map,
              title: item.name,
              content: img
            });

            marker.addEventListener('gmp-click', openInfoWindow);
            img.addEventListener('click', openInfoWindow);
          } else {
            marker = new mapsSDK.Marker({
              position: { lat, lng },
              map,
              title: item.name,
              icon: {
                url: iconUrl,
                scaledSize: new mapsSDK.Size(26, 31),
                anchor: new mapsSDK.Point(13, 31)
              }
            });

            marker.addListener('click', openInfoWindow);
          }

          bounds.extend({ lat, lng });
          totalMarkers++;
          markersRef.current.push(marker);
        });
      });

      // Fit map bounds to encompass visible category markers if no route active
      if (totalMarkers > 0 && map && typeof map.fitBounds === 'function') {
        map.fitBounds(bounds, { top: 170, bottom: 100, left: 60, right: 60 });
      }
    }).catch((err) => {
      console.error('[CategoryMarkersLayer] Error rendering markers:', err);
    });

    return () => {
      isMounted = false;
      clearMarkers(markersRef);
    };
  }, [map, mapsSDK, destId, visibleCategories, destinations, fetchDestinations]);

  return null;
}
