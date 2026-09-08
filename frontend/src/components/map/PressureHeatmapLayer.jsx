import { useEffect, useRef, useState } from 'react';
import api from '../../lib/api';
import { useDestinationsStore } from '../../store/useDestinationsStore';
import { scoreColor } from '../pressure/scoreColor';

/**
 * PressureHeatmapLayer - Renders crowd pressure density across 36 destinations.
 * Supports `google.maps.visualization.HeatmapLayer` when available, and falls back
 * smoothly to styled `google.maps.Circle` pressure density overlays.
 *
 * Props:
 * - map: google.maps.Map instance
 * - mapsSDK: google.maps namespace
 * - date: YYYY-MM-DD date string
 * - visible: boolean toggle state (Default: false)
 */
export default function PressureHeatmapLayer({ map, mapsSDK, date = '2026-12-26', visible = false }) {
  const circlesRef = useRef([]);
  const [pressureData, setPressureData] = useState([]);
  const destinations = useDestinationsStore((state) => state.destinations);
  const fetchDestinations = useDestinationsStore((state) => state.fetchDestinations);
  const destinationsMap = destinations.reduce((result, d) => {
    if (d.location?.lat && d.location?.lng) {
      result[d._id || d.id] = { ...d.location, displayName: d.displayName };
    }
    return result;
  }, {});

  // Helper to clear density circles
  const clearCircles = () => {
    circlesRef.current.forEach((c) => {
      if (c && typeof c.setMap === 'function') c.setMap(null);
    });
    circlesRef.current = [];
  };

  useEffect(() => {
    fetchDestinations().catch((err) => console.error('[PressureHeatmapLayer] Failed to load destinations:', err));
  }, [fetchDestinations]);

  // Step 2: Load date-specific pressure scores whenever `date` changes
  useEffect(() => {
    if (!date) return;
    let isMounted = true;

    api.get(`/v1/pressure/map?date=${date}`)
      .then((res) => {
        if (!isMounted) return;
        const rows = res.data || [];
        setPressureData(rows);
      })
      .catch((err) => {
        console.error('[PressureHeatmapLayer] Failed to load pressure map data:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [date]);

  // Step 3: Render pressure density circles. Google retired the
  // visualization.HeatmapLayer API, so circles are the supported rendering
  // path and avoid invoking a deprecated SDK constructor.
  useEffect(() => {
    if (!map || !mapsSDK) return;

    if (Object.keys(destinationsMap).length === 0) return;

    // Render google.maps.Circle pressure overlays across all destinations.
    clearCircles();

    if (visible) {
      pressureData.forEach((row) => {
        const destCoords = destinationsMap[row.destId];
        if (destCoords) {
          const score = typeof row.score === 'number' ? row.score : null;
          const color = scoreColor(score);
          const isUnknown = score == null;

          const circle = new mapsSDK.Circle({
            strokeColor: color,
            strokeOpacity: 0.8,
            strokeWeight: 1.5,
            fillColor: color,
            fillOpacity: isUnknown ? 0.15 : 0.35,
            map,
            center: { lat: destCoords.lat, lng: destCoords.lng },
            radius: isUnknown ? 15000 : Math.max(15000, score * 40000) // 15km to 40km density radius
          });

          circlesRef.current.push(circle);
        }
      });
    }
  }, [map, mapsSDK, destinationsMap, pressureData, visible]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearCircles();
    };
  }, []);

  return null;
}
