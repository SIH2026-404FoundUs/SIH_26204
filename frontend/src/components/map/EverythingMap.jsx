import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '../../lib/googleMapsLoader';
import api from '../../lib/api';
import DestinationMarkersLayer from './DestinationMarkersLayer';
import PressureHeatmapLayer from './PressureHeatmapLayer';
import CategoryMarkersLayer from './CategoryMarkersLayer';
import RoutePolylineLayer from './RoutePolylineLayer';
import RouteDetailsPanel from './RouteDetailsPanel';
import MapControls from './MapControls';

/**
 * EverythingMap - Base Canvas component for the "Everything on One Map" feature.
 * Opens initially centered on India with all 36 destination pointers active across India.
 * Category markers and Pressure Heatmap are OFF by default.
 * Route Polyline & Details Panel display when user clicks "Get Route".
 *
 * Props:
 * - center: { lat, lng } (Default: India center { lat: 20.5937, lng: 78.9629 })
 * - zoom: number (Default: 5)
 * - source: string (Default: 'Delhi')
 * - destId: string (Default: '')
 * - travelMode: string (Default: 'DRIVE')
 * - className: string (CSS class overrides)
 * - mapOptions: object (Custom google.maps.MapOptions)
 * - defaultHeatmap: boolean (Default: false)
 * - date: string (Default: '2026-12-26')
 * - onMapLoad: function(mapInstance, mapsSDK)
 */
export default function EverythingMap({
  center = { lat: 20.5937, lng: 78.9629 },
  zoom = 5,
  source: initialSource = 'Delhi',
  destId: initialDestId = '',
  travelMode: initialTravelMode = 'DRIVE',
  className = 'h-[600px] w-full rounded-2xl overflow-hidden shadow-sm border border-slate-200',
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

  // Search & Selector States
  const [source, setSource] = useState(initialSource);
  const [selectedDestId, setSelectedDestId] = useState(initialDestId);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [travelMode, setTravelMode] = useState(initialTravelMode);

  // Route Polyline & Details Panel States
  const [routeData, setRouteData] = useState(null);
  const [isFetchingRoute, setIsFetchingRoute] = useState(false);
  const [routeError, setRouteError] = useState(null);

  // Layer Toggles (OFF by default per user specification)
  const [heatmapVisible, setHeatmapVisible] = useState(defaultHeatmap);
  const [visibleCategories, setVisibleCategories] = useState({
    stays: false,
    food: false,
    attractions: false,
    transport: false,
    localServices: false
  });

  const handleToggleCategory = (categoryKey, isVisible) => {
    setVisibleCategories((prev) => ({
      ...prev,
      [categoryKey]: isVisible
    }));
  };

  useEffect(() => {
    let isMounted = true;

    loadGoogleMaps()
      .then((googleMaps) => {
        if (!isMounted || !mapRef.current) return;

        if (!mapInstance) {
          const defaultOptions = {
            center,
            zoom,
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

  // Sync destination selection -> pan map to destination coordinates if selected (only when no route is active)
  useEffect(() => {
    if (!mapInstance || !selectedDestId || routeData) return;

    api.get('/destinations')
      .then((res) => {
        const dests = res.data?.data || res.data || [];
        const dest = dests.find((d) => (d._id || d.id) === selectedDestId);
        if (dest?.location?.lat && dest?.location?.lng) {
          mapInstance.panTo({ lat: dest.location.lat, lng: dest.location.lng });
          mapInstance.setZoom(11);
        }
      })
      .catch((err) => {
        console.error('[EverythingMap] Failed to pan to destination coordinates:', err);
      });
  }, [selectedDestId, mapInstance, routeData]);

  // Handle "Get Route" -> Geocode + POST /api/routes + GET /api/fare
  const handleFetchRoute = async () => {
    if (!source || !selectedDestId) {
      setRouteData(null);
      return;
    }

    setIsFetchingRoute(true);
    setRouteError(null);

    try {
      // 1. Geocode origin address -> { lat, lng }
      const geoRes = await api.get('/geocode', { params: { address: source } });
      const originCoords = geoRes.data?.data;
      if (!originCoords?.lat || !originCoords?.lng) {
        throw new Error(`Could not find location for '${source}'`);
      }

      // 2. Fetch destination list -> find destination lat/lng & name
      const destsRes = await api.get('/destinations');
      const dests = destsRes.data?.data || destsRes.data || [];
      const dest = dests.find((d) => (d._id || d.id) === selectedDestId);
      if (!dest?.location?.lat || !dest?.location?.lng) {
        throw new Error(`Destination coordinates missing for '${selectedDestId}'`);
      }
      const destCoords = { lat: dest.location.lat, lng: dest.location.lng };
      const destName = dest.displayName || dest.name || dest._id;

      // 3. Map mode for Google Routes API (POST /api/routes)
      const apiModeMap = {
        DRIVE: 'DRIVE',
        TRANSIT: 'TRANSIT',
        WALK: 'WALK',
        TWO_WHEELER: 'TWO_WHEELER',
        TRAIN: 'TRANSIT',
        FLIGHT: 'DRIVE'
      };
      const routeModeParam = apiModeMap[travelMode] || 'DRIVE';

      const routeRes = await api.post('/routes', {
        originLat: originCoords.lat,
        originLng: originCoords.lng,
        destLat: destCoords.lat,
        destLng: destCoords.lng,
        mode: routeModeParam
      });

      const routeInfoData = routeRes.data?.data || {};
      const distanceKm = routeInfoData.distanceKm || 0;
      const durationMinutes = routeInfoData.durationMinutes || 0;

      // 4. Calculate realistic Inter-City Fares (in ₹ INR)
      let fareINR = null;
      if (travelMode === 'WALK') {
        fareINR = 0;
      } else if (travelMode === 'TRANSIT') {
        // Inter-city Bus fare (~₹1.5 per km)
        fareINR = Math.round(distanceKm * 1.5);
      } else if (travelMode === 'TRAIN') {
        // Express/Sleeper Train fare
        fareINR = Math.round(distanceKm * 0.9 + 120);
      } else if (travelMode === 'FLIGHT') {
        // Flight fare
        fareINR = distanceKm > 200 ? Math.round(distanceKm * 3.5 + 1800) : 2500;
      } else if (travelMode === 'TWO_WHEELER') {
        // Bike fuel cost (~₹3.2 per km)
        fareINR = Math.round(distanceKm * 3.2);
      } else {
        // Car / Cab fare (~₹12 per km)
        fareINR = Math.round(distanceKm * 12 + 200);
      }

      setRouteData({
        sourceName: originCoords.formattedAddress || source,
        destName,
        originCoords: { lat: originCoords.lat, lng: originCoords.lng },
        destCoords,
        polyline: routeInfoData.polyline || null,
        distanceKm,
        durationMinutes,
        fareINR,
        travelMode
      });
    } catch (err) {
      console.error('[EverythingMap] Failed to fetch route:', err);
      setRouteError(err.message || 'Failed to calculate route');
    } finally {
      setIsFetchingRoute(false);
    }
  };

  // Auto-calculate route whenever destination, source, or travelMode changes
  useEffect(() => {
    if (source && selectedDestId) {
      handleFetchRoute();
    } else {
      setRouteData(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDestId, travelMode, source]);

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
      {/* Floating Control Overlay (Source, Destination, Date, Mode, Route Button, Toggles) */}
      {!loading && !error && (
        <MapControls
          source={source}
          onChangeSource={setSource}
          destId={selectedDestId}
          onChangeDestId={setSelectedDestId}
          date={selectedDate}
          onChangeDate={setSelectedDate}
          travelMode={travelMode}
          onChangeTravelMode={setTravelMode}
          onFetchRoute={handleFetchRoute}
          isFetchingRoute={isFetchingRoute}
          heatmapVisible={heatmapVisible}
          onToggleHeatmap={setHeatmapVisible}
          visibleCategories={visibleCategories}
          onToggleCategory={handleToggleCategory}
        />
      )}

      {/* Map Container Canvas */}
      <div ref={mapRef} className="h-full w-full min-h-[500px] bg-slate-100" />

      {/* 1. Destination Pointers Layer (ALWAYS ACTIVE BY DEFAULT on India map view) */}
      {mapInstance && mapsSDK && (
        <DestinationMarkersLayer
          map={mapInstance}
          mapsSDK={mapsSDK}
          selectedDestId={selectedDestId}
          onSelectDestination={setSelectedDestId}
        />
      )}

      {/* 2. Pressure Heatmap Layer (OFF by default) */}
      {mapInstance && mapsSDK && (
        <PressureHeatmapLayer
          map={mapInstance}
          mapsSDK={mapsSDK}
          date={selectedDate}
          visible={heatmapVisible}
        />
      )}

      {/* 3. Category Markers Layer (OFF by default) */}
      {mapInstance && mapsSDK && selectedDestId && (
        <CategoryMarkersLayer
          map={mapInstance}
          mapsSDK={mapsSDK}
          destId={selectedDestId}
          visibleCategories={visibleCategories}
        />
      )}

      {/* 4. Route Polyline Layer */}
      {mapInstance && mapsSDK && routeData && (
        <RoutePolylineLayer
          map={mapInstance}
          mapsSDK={mapsSDK}
          routeData={routeData}
        />
      )}

      {/* 5. Route Details Floating Panel */}
      {routeData && (
        <RouteDetailsPanel
          routeInfo={routeData}
          onClose={() => setRouteData(null)}
        />
      )}

      {/* Route Error Notification Toast */}
      {routeError && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-20 rounded-xl border border-rose-200 bg-rose-50/95 px-4 py-2 text-xs font-bold text-rose-700 shadow-md backdrop-blur-xs flex items-center gap-2">
          <span>⚠️ {routeError}</span>
          <button
            type="button"
            onClick={() => setRouteError(null)}
            className="text-rose-400 hover:text-rose-700 ml-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50/80 backdrop-blur-xs">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-indigo-600 border-t-transparent" />
            <span className="text-xs font-semibold text-slate-600">Initializing India Interactive Map...</span>
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

