import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '../../lib/googleMapsLoader';

/**
 * EverythingMap - Base Canvas component for the "Everything on One Map" feature.
 * Asynchronously initializes Google Maps JS SDK via `googleMapsLoader`.
 *
 * Props:
 * - center: { lat, lng } (Default: India center { lat: 20.5937, lng: 78.9629 })
 * - zoom: number (Default: 5)
 * - className: string (CSS class overrides)
 * - mapOptions: object (Custom google.maps.MapOptions)
 * - onMapLoad: function(mapInstance, mapsSDK) (Callback when map finishes initialization)
 */
export default function EverythingMap({
  center = { lat: 20.5937, lng: 78.9629 },
  zoom = 5,
  className = 'h-[500px] w-full rounded-2xl overflow-hidden shadow-sm border border-slate-200',
  mapOptions = {},
  onMapLoad
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    loadGoogleMaps()
      .then((googleMaps) => {
        if (!isMounted || !mapRef.current) return;

        if (!mapInstanceRef.current) {
          const defaultOptions = {
            center,
            zoom,
            mapId: 'DEMO_MAP_ID', // Enables modern vector styling if available
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

          const mapInstance = new googleMaps.Map(mapRef.current, defaultOptions);
          mapInstanceRef.current = mapInstance;

          if (typeof onMapLoad === 'function') {
            onMapLoad(mapInstance, googleMaps);
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
  }, []);

  // Update center when prop changes dynamically
  useEffect(() => {
    if (mapInstanceRef.current && center) {
      mapInstanceRef.current.panTo(center);
    }
  }, [center?.lat, center?.lng]);

  // Update zoom when prop changes
  useEffect(() => {
    if (mapInstanceRef.current && typeof zoom === 'number') {
      mapInstanceRef.current.setZoom(zoom);
    }
  }, [zoom]);

  return (
    <div className={`relative ${className}`}>
      {/* Map Container Ref */}
      <div ref={mapRef} className="h-full w-full bg-slate-100" />

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50/80 backdrop-blur-xs">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-indigo-600 border-t-transparent" />
            <span className="text-xs font-semibold text-slate-600">Initializing Interactive Map...</span>
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
