import { useEffect, useRef, useState } from 'react';
import api from '../../lib/api';

/**
 * PressureHeatmapLayer - Renders a Google Maps Visualization HeatmapLayer
 * showing crowd pressure density across 36 tracked destinations for a specific date.
 *
 * Color Gradient:
 * - Low pressure (<=0.4): Translucent Green
 * - Medium pressure (0.4-0.7): Yellow / Amber
 * - High pressure (>=0.8): Intense Red
 *
 * Props:
 * - map: google.maps.Map instance
 * - mapsSDK: google.maps namespace
 * - date: YYYY-MM-DD date string
 * - visible: boolean toggle state (Default: false)
 */
export default function PressureHeatmapLayer({ map, mapsSDK, date = '2026-12-26', visible = false }) {
  const heatmapRef = useRef(null);
  const [pressureData, setPressureData] = useState([]);
  const [destinationsMap, setDestinationsMap] = useState({});

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

  // Step 3: Initialize or update google.maps.visualization.HeatmapLayer
  useEffect(() => {
    if (!map || !mapsSDK || !mapsSDK.visualization || typeof mapsSDK.visualization.HeatmapLayer !== 'function') {
      return;
    }

    if (Object.keys(destinationsMap).length === 0) return;

    // Convert pressure rows into weighted LatLng points
    const points = [];
    pressureData.forEach((row) => {
      const destCoords = destinationsMap[row.destId];
      if (destCoords) {
        const score = typeof row.score === 'number' ? row.score : 0.5;
        points.push({
          location: new mapsSDK.LatLng(destCoords.lat, destCoords.lng),
          weight: Math.max(0.1, score * 3) // Scale weight for visually distinct gradient intensity
        });
      }
    });

    // Custom gradient: Green (0x00FF00) -> Yellow (0xFFFF00) -> Orange (0xFF9900) -> Dark Red (0xCC0000)
    const gradient = [
      'rgba(0, 255, 128, 0)',
      'rgba(34, 197, 94, 0.8)',
      'rgba(234, 179, 8, 0.9)',
      'rgba(249, 115, 22, 0.95)',
      'rgba(239, 68, 68, 1)',
      'rgba(185, 28, 28, 1)'
    ];

    try {
      if (!heatmapRef.current) {
        const heatmap = new mapsSDK.visualization.HeatmapLayer({
          data: points,
          map: visible ? map : null,
          radius: 35,
          opacity: 0.75,
          gradient
        });
        heatmapRef.current = heatmap;
      } else {
        heatmapRef.current.setData(points);
        heatmapRef.current.setMap(visible ? map : null);
      }
    } catch (err) {
      console.warn('[PressureHeatmapLayer] HeatmapLayer is unavailable in this Google Maps SDK version:', err.message);
    }
  }, [map, mapsSDK, destinationsMap, pressureData, visible]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (heatmapRef.current) {
        heatmapRef.current.setMap(null);
        heatmapRef.current = null;
      }
    };
  }, []);

  return null;
}
