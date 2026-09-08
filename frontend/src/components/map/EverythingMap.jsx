import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '../../lib/googleMapsLoader';
import PressureHeatmapLayer from './PressureHeatmapLayer';
import MapControls from './MapControls';

/**
 * EverythingMap - Base Canvas component for the "Everything on One Map" feature.
 * Integrates Google Maps JS SDK, floating layer controls, and toggleable HeatmapLayer.
 *
 * Props:
 * - center: { lat, lng } (Default: India center { lat: 20.5937, lng: 78.9629 })
 * - zoom: number (Default: 5)
 * - className: string (CSS class overrides)
 * - mapOptions: object (Custom google.maps.MapOptions)
 * - defaultHeatmap: boolean (Default: false)
 * - date: string (Default: '2026-12-26')
 * - onMapLoad: function(mapInstance, mapsSDK)
 */
export default function EverythingMap({
  center = { lat: 20.5937, lng: 78.9629 },
  zoom = 5,
  className = 'h-[550px] w-full rounded-2xl overflow-hidden shadow-sm border border-slate-200',
  mapOptions = {},
  defaultHeatmap = false,
  date: initialDate = '2026-12-26',
  onMapLoad
}) {
  const mapRef = useRef(null);
  const [mapInstance, setMapInstance] = useState(null);
  const [mapsSDK, setMapsSDK] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Layer & Control States
  const [heatmapVisible, setHeatmapVisible] = useState(defaultHeatmap);
  const [selectedDate, setSelectedDate] = useState(initialDate);

  useEffect(() => {
    let isMounted = true;

    loadGoogleMaps()
      .then((googleMaps) => {
        if (!isMounted || !mapRef.current) return;

        if (!mapInstance) {
          const defaultOptions = {
            center,
            zoom,
            mapId: 'DEMO_MAP_ID',
            zoomControl: true,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            styles: [
              {
                featureType: 'poi',
                elementType: 'labels',
                stylers: [{ visibility: 'simplified' }]
              }
            ],
            ...mapOptions
          };

          const instance = new googleMaps.Map(mapRef.current, defaultOptions);
          setMapInstance(instance);
          setMapsSDK(googleMaps);

          if (typeof onMapLoad === 'function') {
            onMapLoad(instance, googleMaps);
          }
        }

        setLoading(false);
      })
      .catch((err) => {
        if (isMounted) {
          console.error('[EverythingMap] Google Maps initialization error:', err);
          setError(err.message || 'Failed to load Google Maps SDK');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync center prop updates
  useEffect(() => {
    if (mapInstance && center) {
      mapInstance.panTo(center);
    }
  }, [center, mapInstance]);

  // Sync zoom prop updates
  useEffect(() => {
    if (mapInstance && typeof zoom === 'number') {
      mapInstance.setZoom(zoom);
    }
  }, [zoom, mapInstance]);

  return (
    <div className={`relative ${className}`}>
      {/* Floating Control Overlay */}
      {!loading && !error && (
        <MapControls
          heatmapVisible={heatmapVisible}
          onToggleHeatmap={setHeatmapVisible}
          date={selectedDate}
          onChangeDate={setSelectedDate}
        />
      )}

      {/* Map Container Canvas */}
      <div ref={mapRef} className="h-full w-full bg-slate-100" />

      {/* Pressure Heatmap Layer */}
      {mapInstance && mapsSDK && (
        <PressureHeatmapLayer
          map={mapInstance}
          mapsSDK={mapsSDK}
          date={selectedDate}
          visible={heatmapVisible}
        />
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50/80 backdrop-blur-xs">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-indigo-600 border-t-transparent" />
            <span className="text-xs font-semibold text-slate-600">Loading Map Layers...</span>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {error && !loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-rose-50/90 p-4">
          <div className="rounded-xl border border-rose-200 bg-white p-4 text-center shadow-xs">
            <p className="text-sm font-semibold text-rose-700">Map Loading Error</p>
            <p className="mt-1 text-xs text-rose-500">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
