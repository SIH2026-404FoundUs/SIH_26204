import { useEffect, useRef, useState } from 'react';
import api from '../../lib/api';
import { useDestinationsStore } from '../../store/useDestinationsStore';
import { scoreColor, scoreLabel } from '../pressure/scoreColor';

/**
 * PressureHeatmapLayer - Renders crowd pressure density across tracked destinations.
 *
 * Google retired `visualization.HeatmapLayer`, so this draws `google.maps.Circle`
 * overlays instead. Colour and radius both encode the same 0..1 score, which on
 * its own is unreadable -- a viewer sees overlapping blobs with no idea whether
 * darker means busier or what "busy" is. So the circles are accompanied by:
 *   - a legend naming the three bands in plain English,
 *   - a click target on every circle giving that destination's actual number,
 * because colour alone is never an acceptable sole signal.
 *
 * Props:
 * - map: google.maps.Map instance
 * - mapsSDK: google.maps namespace
 * - date: YYYY-MM-DD date string
 * - visible: boolean toggle state (Default: false)
 */
export default function PressureHeatmapLayer({ map, mapsSDK, date, visible = false }) {
  const circlesRef = useRef([]);
  const infoWindowRef = useRef(null);
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
    if (infoWindowRef.current) infoWindowRef.current.close();
  };

  useEffect(() => {
    fetchDestinations().catch((err) => console.error('[PressureHeatmapLayer] Failed to load destinations:', err));
  }, [fetchDestinations]);

  // Load date-specific pressure scores whenever `date` changes.
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

  useEffect(() => {
    if (!map || !mapsSDK) return;
    if (Object.keys(destinationsMap).length === 0) return;

    clearCircles();
    if (!visible) return;

    if (!infoWindowRef.current) {
      infoWindowRef.current = new mapsSDK.InfoWindow();
    }

    pressureData.forEach((row) => {
      const destCoords = destinationsMap[row.destId];
      if (!destCoords) return;

      const score = typeof row.score === 'number' ? row.score : null;
      const color = scoreColor(score);
      const isUnknown = score == null;
      const center = { lat: destCoords.lat, lng: destCoords.lng };

      const circle = new mapsSDK.Circle({
        strokeColor: color,
        strokeOpacity: 0.9,
        strokeWeight: 1.5,
        fillColor: color,
        fillOpacity: isUnknown ? 0.12 : 0.34,
        map,
        center,
        clickable: true,
        radius: isUnknown ? 15000 : Math.max(15000, score * 40000), // 15km to 40km density radius
      });

      // Colour and size are comparative at best. A click gives the actual
      // reading, named, so the layer is readable rather than merely pretty.
      circle.addListener('click', () => {
        const name = destCoords.displayName || row.destId;
        const readout = isUnknown
          ? 'No crowding data for this date'
          : `${Math.round(score * 100)}% crowded &middot; ${scoreLabel(score)}`;
        infoWindowRef.current.setContent(
          `<div style="font:600 12px system-ui,sans-serif;color:#111827;padding:2px 4px">
             ${name}<div style="font-weight:500;color:#4B5563;margin-top:2px">${readout}</div>
           </div>`
        );
        infoWindowRef.current.setPosition(center);
        infoWindowRef.current.open(map);
      });

      circlesRef.current.push(circle);
    });
  }, [map, mapsSDK, destinationsMap, pressureData, visible]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearCircles();
    };
  }, []);

  // The legend is rendered separately (PressureLegend) by EverythingMap.
  return null;
}
