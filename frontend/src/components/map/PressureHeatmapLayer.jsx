import { useEffect, useRef, useState } from 'react';
import api from '../../lib/api';

/**
 * PressureHeatmapLayer - Renders crowd pressure density across 36 destinations.
 * Supports `google.maps.visualization.HeatmapLayer` when available, and falls back
 * smoothly to styled `google.maps.Circle` pressure density overlays.
 *
 * Color Scheme:
 * - Low pressure (<=0.45): Green (#22C55E)
 * - Medium pressure (0.45-0.65): Amber (#F59E0B)
 * - High pressure (>=0.65): Red (#EF4444)
 *
 * Props:
 * - map: google.maps.Map instance
 * - mapsSDK: google.maps namespace
 * - date: YYYY-MM-DD date string
 * - visible: boolean toggle state (Default: false)
 */
export default function PressureHeatmapLayer({ map, mapsSDK, date = '2026-12-26', visible = false }) {
  const heatmapRef = useRef(null);
  const circlesRef = useRef([]);
  const [pressureData, setPressureData] = useState([]);
  const [destinationsMap, setDestinationsMap] = useState({});

  // Helper to clear density circles
  const clearCircles = () => {
    circlesRef.current.forEach((c) => {
      if (c && typeof c.setMap === 'function') c.setMap(null);
    });
    circlesRef.current = [];
  };

  // Step 1: Load destination coordinates baseline once
  useEffect(() => {
    let isMounted = true;

    api.get('/destinations')
      .then((res) => {
        if (!isMounted) return;
        const dests = res.data?.data || res.data || [];
        const mapById = {};
        dests.forEach((d) => {
          if (d.location?.lat && d.location?.lng) {
            mapById[d._id || d.id] = {
              lat: d.location.lat,
              lng: d.location.lng,
              displayName: d.displayName
            };
          }
        });
        setDestinationsMap(mapById);
      })
      .catch((err) => {
        console.error('[PressureHeatmapLayer] Failed to load destination coordinates:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

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

  // Step 3: Render HeatmapLayer or fallback Pressure Density Circles
  useEffect(() => {
    if (!map || !mapsSDK) return;

    if (Object.keys(destinationsMap).length === 0) return;

    const hasHeatmapLayer =
      mapsSDK.visualization &&
      typeof mapsSDK.visualization.HeatmapLayer === 'function';

    if (hasHeatmapLayer) {
      const points = [];
      pressureData.forEach((row) => {
        const destCoords = destinationsMap[row.destId];
        if (destCoords) {
          const score = typeof row.score === 'number' ? row.score : 0.5;
          points.push({
            location: new mapsSDK.LatLng(destCoords.lat, destCoords.lng),
            weight: Math.max(0.2, score * 5)
          });
        }
      });

      const gradient = [
        'rgba(34, 197, 94, 0)',
        'rgba(34, 197, 94, 0.7)',
        'rgba(234, 179, 8, 0.85)',
        'rgba(249, 115, 22, 0.95)',
        'rgba(239, 68, 68, 1)',
        'rgba(159, 18, 57, 1)'
      ];

      try {
        if (!heatmapRef.current) {
          const heatmap = new mapsSDK.visualization.HeatmapLayer({
            data: points,
            map: visible ? map : null,
            radius: 50,
            opacity: 0.85,
            maxIntensity: 4,
            gradient
          });
          heatmapRef.current = heatmap;
        } else {
          heatmapRef.current.setData(points);
          heatmapRef.current.setMap(visible ? map : null);
        }
        return;
      } catch (err) {
        console.warn('[PressureHeatmapLayer] Falling back to pressure density circles:', err.message);
      }
    }

    // Fallback: Render google.maps.Circle pressure overlays across all destinations
    clearCircles();

    if (visible) {
      pressureData.forEach((row) => {
        const destCoords = destinationsMap[row.destId];
        if (destCoords) {
          const score = typeof row.score === 'number' ? row.score : 0.5;

          // Color selection based on pressure score
          let color = '#22C55E'; // Green
          if (score >= 0.65) {
            color = '#EF4444'; // Red
          } else if (score >= 0.45) {
            color = '#F59E0B'; // Amber
          }

          const circle = new mapsSDK.Circle({
            strokeColor: color,
            strokeOpacity: 0.8,
            strokeWeight: 1.5,
            fillColor: color,
            fillOpacity: 0.35,
            map,
            center: { lat: destCoords.lat, lng: destCoords.lng },
            radius: Math.max(15000, score * 40000) // 15km to 40km density radius
          });

          circlesRef.current.push(circle);
        }
      });
    }
  }, [map, mapsSDK, destinationsMap, pressureData, visible]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (heatmapRef.current) {
        heatmapRef.current.setMap(null);
        heatmapRef.current = null;
      }
      clearCircles();
    };
  }, []);

  return null;
}
