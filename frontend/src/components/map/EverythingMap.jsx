import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadGoogleMaps } from '../../lib/googleMapsLoader';
import api from '../../lib/api';
import DestinationMarkersLayer from './layers/DestinationMarkersLayer';
import PressureHeatmapLayer from './layers/PressureHeatmapLayer';
import CategoryMarkersLayer from './layers/CategoryMarkersLayer';
import RoutePolylineLayer from './layers/RoutePolylineLayer';
import RouteDetailsPanel from './trip/RouteDetailsPanel';
import MapControls from './controls/MapControlsPremium';
import PlacesLayer from './layers/PlacesLayer';
import StopPickerPanel from './trip/StopPickerPanel';
import RecommendationOverlay from './ai/RecommendationOverlay';
import TripSummaryPanel from './trip/TripSummaryPremium';
import SwapCard from '../swap/SwapCard';
import LayerControls from './controls/LayerControls';
import AIAssistantCard from './ai/AIAssistantPremium';
import CurrentLocationLayer from './layers/CurrentLocationLayer';
import StopMarkersLayer from './layers/StopMarkersLayer';
import PressureLegend from './PressureLegend';
import MapToolRail from './MapToolRail';
import { useDestinationsStore } from '../../store/useDestinationsStore';
import { usePlannerStore } from '../../store/usePlannerStore';
import { useAuthStore } from '../../store/useAuthStore';
import { downloadTravelBrief } from '../../lib/travelBrief';
import { AlertTriangle, LogIn, Lock, MapPinPlus, MousePointerClick, X } from 'lucide-react';

// A scrolling column of floating panels. The column itself ignores the
// pointer so the map stays draggable in the gaps between panels, and the
// negative margin + padding stops overflow-y-auto clipping panel shadows.
const DOCK_CLASS = 'pointer-events-none -m-4 flex min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain p-4 no-scrollbar [&>*]:pointer-events-auto [&>*]:shrink-0';

function MapToast({ tone = 'error', children, onDismiss }) {
  const toneClass = tone === 'error' ? 'border-rose-200 bg-rose-50/95 text-rose-700' : 'border-amber-200 bg-amber-50/95 text-amber-800';
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`pointer-events-auto flex max-w-md items-start gap-2 rounded-xl border px-3 py-2 text-xs font-semibold shadow-md backdrop-blur-xs animate-fade-up ${toneClass}`}>
      <AlertTriangle size={14} className="mt-px shrink-0" />
      <span className="min-w-0 flex-1">{children}</span>
      <button type="button" onClick={onDismiss} className="-mr-1 rounded-md p-0.5 opacity-60 transition hover:opacity-100" aria-label="Dismiss">
        <X size={13} />
      </button>
    </div>
  );
}

function estimateIntercityDistanceKm(origin, destination) {
  const radians = (value) => (value * Math.PI) / 180;
  const latDelta = radians(destination.lat - origin.lat);
  const lngDelta = radians(destination.lng - origin.lng);
  const a = Math.sin(latDelta / 2) ** 2 + Math.cos(radians(origin.lat)) * Math.cos(radians(destination.lat)) * Math.sin(lngDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * EverythingMap - Base Canvas component for the "Everything on One Map" feature.
 * Opens initially centered on India with all 36 destination pointers active across India.
 * Category markers and Pressure Heatmap are OFF by default.
 * Route Polyline & Details Panel display when user clicks "Get Route".
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
  const containerRef = useRef(null);
  const navigate = useNavigate();
  const [layersOpen, setLayersOpen] = useState(false);
  const [mapInstance, setMapInstance] = useState(null);
  const [mapsSDK, setMapsSDK] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [useCurrentLocation, setUseCurrentLocation] = useState(true);
  const [locationTracking, setLocationTracking] = useState(false);
  const [locationError, setLocationError] = useState(null);

  // Search & Selector States
  const [source, setSource] = useState(initialSource);
  const [debouncedSource, setDebouncedSource] = useState(initialSource);
  const [selectedDestId, setSelectedDestId] = useState(initialDestId);
  const [startDate, setStartDate] = useState(initialDate || '2026-12-25');
  const [endDate, setEndDate] = useState('2026-12-28');
  const [budgetInr, setBudgetInr] = useState(20000);
  const [travellers, setTravellers] = useState(2);
  const [travelMode, setTravelMode] = useState(initialTravelMode);

  // Route Polyline & Details Panel States
  const [routeData, setRouteData] = useState(null);
  const routeRequestIdRef = useRef(0);
  const [previewRouteData, setPreviewRouteData] = useState(null);
  const [isFetchingRoute, setIsFetchingRoute] = useState(false);
  const [plannerStage, setPlannerStage] = useState('');
  const [routeError, setRouteError] = useState(null);
  const [authAlert, setAuthAlert] = useState(false);
  const [isSearchingStop, setIsSearchingStop] = useState(false);

  const destinations = useDestinationsStore((state) => state.destinations);
  const fetchDestinations = useDestinationsStore((state) => state.fetchDestinations);
  const { submitTrip, applySwap, isPlanning, awaitingDecision, plan, request } = usePlannerStore();
  const swapOffers = plan?.trip?.alternatives?.swapOffers;

  // Google Places Nearby Toggles (Hotels & Restaurants)
  const [visiblePlaces, setVisiblePlaces] = useState({ hotels: false, restaurants: false });
  const [selectedHotel, setSelectedHotel] = useState(null);

  // Stop Picker & Drawer State
  const [stops, setStops] = useState([]);
  const [showStopsPanel, setShowStopsPanel] = useState(false);
  // The map click listener is registered once, so it reads the panel state
  // through a ref. Clicks only drop stops while the Stops panel is open --
  // previously every click on the map added a stop, including clicks meant
  // to dismiss a popup or just focus the map.
  const dropPinModeRef = useRef(false);
  useEffect(() => { dropPinModeRef.current = showStopsPanel; }, [showStopsPanel]);
  const [highlightedDestId, setHighlightedDestId] = useState(null);
  const [showTripSummary, setShowTripSummary] = useState(true);
  // Dismissal applies to the plan it was made on, not to the whole session.
  // Both dismissing the card and applying a swap set this, and nothing used to
  // clear it -- so after the first swap (or the first dismissal) the card never
  // appeared again for any later trip, which reads as "the swap UI doesn't
  // work". Storing WHICH plan was dismissed derives the flag instead of
  // resetting it from an effect, so a new plan is automatically a new offer.
  const [dismissedForPlan, setDismissedForPlan] = useState(null);
  const [previewForPlan, setPreviewForPlan] = useState(null);
  const swapDismissed = dismissedForPlan === plan;
  const swapPreviewOpen = previewForPlan === plan;
  const setSwapDismissed = (value) => setDismissedForPlan(value ? plan : null);
  const setSwapPreviewOpen = (value) => setPreviewForPlan(value ? plan : null);

  // Layer Toggles (OFF by default)
  const [heatmapVisible, setHeatmapVisible] = useState(defaultHeatmap);
  const [visibleCategories, setVisibleCategories] = useState({
    stays: false,
    food: false,
    attractions: false,
    transport: false,
    localServices: false
  });

  const handleToggleCategory = (categoryKey, isVisible) => {
    setVisibleCategories((prev) => ({ ...prev, [categoryKey]: isVisible }));
  };

  // Zoom in near destination when Hotels or Restaurants toggle is turned ON
  const handleTogglePlaces = (typeKey, isVisible) => {
    setVisiblePlaces((prev) => ({
      ...prev,
      [typeKey]: isVisible
    }));

    if (isVisible && mapInstance) {
      mapInstance.panTo(activeCenter);
      mapInstance.setZoom(14);
    }
  };

  const handleAddStop = (stopObj) => {
    if (!stopObj?.name || !Number.isFinite(Number(stopObj.lat)) || !Number.isFinite(Number(stopObj.lng))) return;
    setStops((prev) => {
      const duplicate = prev.some((stop) => Math.abs(Number(stop.lat) - Number(stopObj.lat)) < 0.0001 && Math.abs(Number(stop.lng) - Number(stopObj.lng)) < 0.0001);
      return duplicate ? prev : [...prev, { id: `stop_${Date.now()}_${prev.length}`, ...stopObj }];
    });
  };

  // Search Place and Add Stop
  const handleSearchAddStop = async (queryStr) => {
    if (!queryStr) return;
    setIsSearchingStop(true);
    setRouteError(null);
    try {
      let lat, lng, formattedAddress, placeId, photoName;
      try {
        const placesResponse = await api.get('/places', { params: { query: queryStr, lat: activeCenter.lat, lng: activeCenter.lng, radiusMeters: 20000 } });
        const places = placesResponse.data?.data || placesResponse.data || [];
        const place = Array.isArray(places) ? places.find((item) => Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng))) : null;
        if (place) {
          lat = Number(place.lat); lng = Number(place.lng); formattedAddress = place.name || queryStr; placeId = place.placeId; photoName = place.photoName;
        } else {
          const res = await api.get('/geocode', { params: { address: queryStr } });
          const geocoded = res.data?.data ?? res.data;
          if (!Number.isFinite(Number(geocoded?.lat)) || !Number.isFinite(Number(geocoded?.lng))) throw new Error(geocoded?.error || `Could not find location for '${queryStr}'`);
          lat = Number(geocoded.lat); lng = Number(geocoded.lng); formattedAddress = geocoded.formattedAddress || queryStr;
        }
      } catch {
        if (mapsSDK?.Geocoder) {
          const geocoder = new mapsSDK.Geocoder();
          const result = await new Promise((resolve) => {
            geocoder.geocode({ address: queryStr }, (results, status) => {
              if (status === 'OK' && results?.[0]?.geometry?.location) {
                resolve({
                  lat: results[0].geometry.location.lat(),
                  lng: results[0].geometry.location.lng(),
                  formattedAddress: results[0].formatted_address
                });
              } else {
                resolve(null);
              }
            });
          });
          if (result) {
            lat = result.lat;
            lng = result.lng;
            formattedAddress = result.formattedAddress;
          }
        }
      }

      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        setStops((prev) => [
          ...prev,
          { id: `stop_${Date.now()}`, name: formattedAddress || queryStr, lat, lng, placeId, photoName, type: 'search' }
        ]);
        if (mapInstance) {
          mapInstance.panTo({ lat, lng });
          mapInstance.setZoom(12);
        }
      } else {
        setRouteError(`Could not find location for '${queryStr}'`);
      }
      } catch (err) {
      console.error('[EverythingMap] Search stop error:', err);
      setRouteError(`Failed to search location '${queryStr}'`);
    } finally {
      setIsSearchingStop(false);
    }
  };

  const handleRemoveStop = (stopId) => {
    setStops((prev) => prev.filter((s, idx) => (s.id ? s.id !== stopId : idx !== stopId)));
  };

  const handleClearStops = () => setStops([]);

  // Direct Plan Trip execution without redundant side drawer
  const handleDirectPlanTrip = async () => {
    if (!selectedDestId) {
      setRouteError('Please select a destination first');
      return;
    }

    const authUser = useAuthStore.getState().authUser;
    if (!authUser) {
      setAuthAlert(true);
      return;
    }

    const payload = {
      origin: source,
      destId: selectedDestId,
      startDate,
      endDate,
      travellers: Number(travellers) || 1,
      budgetInr: Number(budgetInr) || 0,
      selectedHotel,
      stops
    };

    const stages = ['Checking pressure...', 'Loading route...', 'Loading hotels and places...', 'Analyzing crowding...', 'Preparing itinerary...'];
    let stageIndex = 0;
    setPlannerStage(stages[stageIndex]);
    const stageTimer = window.setInterval(() => {
      stageIndex = Math.min(stageIndex + 1, stages.length - 1);
      setPlannerStage(stages[stageIndex]);
    }, 900);
    try {
      const success = await submitTrip(payload);
      if (success) {
        const state = usePlannerStore.getState();
        if (state.awaitingDecision) {
          // Keep the traveller on the map. RecommendationOverlay owns the
          // accept/decline handshake and lets the map remain the workspace.
          setShowTripSummary(false);
        }
      } else {
        const err = usePlannerStore.getState().error;
        if (err) setRouteError(err);
      }
    } finally {
      window.clearInterval(stageTimer);
      setPlannerStage('');
    }
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
            // Required for AdvancedMarkerElement (used by the layers below) to
            // render -- DEMO_MAP_ID is Google's documented placeholder with no
            // cloud styling attached. Override with VITE_GOOGLE_MAPS_MAP_ID once
            // a real Map ID is created in Cloud Console.
            mapId: import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID',
            // Zoom and fullscreen come from MapToolRail instead: Google's own
            // buttons sat underneath the floating panels.
            zoomControl: false,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            // The map is the whole page here, so scroll-to-zoom shouldn't
            // need Ctrl held down.
            gestureHandling: 'greedy',
            // A Map cannot combine a mapId with inline `styles` -- Google
            // rejects it outright ("A Map's styles property cannot be set
            // when a mapId is present"). The POI-label simplification this
            // used to apply inline now needs to be configured on the Map ID
            // itself in Cloud Console instead.
            ...mapOptions
          };

          const instance = new googleMaps.Map(mapRef.current, defaultOptions);

          // Add Map Click Listener to capture custom stops
          instance.addListener('click', (e) => {
            if (e.latLng && dropPinModeRef.current) {
              const lat = e.latLng.lat();
              const lng = e.latLng.lng();
              handleAddStop({ name: `Pin Stop (${lat.toFixed(3)}, ${lng.toFixed(3)})`, lat, lng, type: 'map_click' });
            }
          });

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

  useEffect(() => {
    if (!mapInstance || !navigator.geolocation || (!useCurrentLocation && !locationTracking)) {
      if (!navigator.geolocation) setLocationError('Location is not supported by this browser.');
      return undefined;
    }

    let firstFix = true;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const nextLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        setCurrentLocation(nextLocation);
        setLocationError(null);
        if (firstFix && useCurrentLocation && mapsSDK?.Geocoder) {
          const geocoder = new mapsSDK.Geocoder();
          geocoder.geocode({ location: { lat: nextLocation.lat, lng: nextLocation.lng } }, (results, status) => {
            if (status === 'OK' && results?.[0]?.formatted_address && useCurrentLocation) {
              setSource(results[0].formatted_address);
            }
          });
        }
        if ((firstFix && useCurrentLocation) || locationTracking) {
          mapInstance.panTo({ lat: nextLocation.lat, lng: nextLocation.lng });
          if (firstFix) mapInstance.setZoom(Math.max(mapInstance.getZoom() || 5, 13));
        }
        firstFix = false;
      },
      (geolocationError) => {
        if (geolocationError.code === geolocationError.PERMISSION_DENIED) {
          setLocationError('Location permission was denied. Enable it in the browser to track your position.');
        } else {
          setLocationError('Unable to read your current location.');
        }
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [mapInstance, mapsSDK, locationTracking, useCurrentLocation]);

  const toggleCurrentLocation = () => {
    if (useCurrentLocation) {
      setUseCurrentLocation(false);
      setLocationTracking(false);
      setCurrentLocation(null);
      return;
    }
    setUseCurrentLocation(true);
    setLocationTracking(true);
    if (currentLocation && mapInstance) {
      mapInstance.panTo({ lat: currentLocation.lat, lng: currentLocation.lng });
      mapInstance.setZoom(Math.max(mapInstance.getZoom() || 5, 13));
    }
  };

  // Tool-rail "my location": follow the traveller's position on the map.
  // Independent of whether that position is also the route's origin.
  const toggleFollowLocation = () => {
    const next = !locationTracking;
    setLocationTracking(next);
    if (next && currentLocation && mapInstance) {
      mapInstance.panTo({ lat: currentLocation.lat, lng: currentLocation.lng });
      mapInstance.setZoom(Math.max(mapInstance.getZoom() || 5, 13));
    }
  };

  // Typing an origin means the traveller wants that place, not their GPS
  // position -- which handleFetchRoute would otherwise silently keep using.
  const handleChangeSource = (value) => {
    if (useCurrentLocation) setUseCurrentLocation(false);
    setSource(value);
  };

  useEffect(() => {
    if (!routeError) return undefined;
    const timer = window.setTimeout(() => setRouteError(null), 8000);
    return () => window.clearTimeout(timer);
  }, [routeError]);

  const activeLayerCount = [heatmapVisible, visiblePlaces.hotels, visiblePlaces.restaurants, ...(selectedDestId ? Object.values(visibleCategories) : [])].filter(Boolean).length;

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSource(source), 500);
    return () => window.clearTimeout(timer);
  }, [source]);

  useEffect(() => {
    fetchDestinations().catch((err) => console.error('[EverythingMap] Failed to load destinations:', err));
  }, [fetchDestinations]);

  // Sync destination selection -> pan map to destination coordinates if selected
  useEffect(() => {
    if (!mapInstance || !selectedDestId || routeData) return;

    const dest = destinations.find((d) => (d._id || d.id) === selectedDestId);
    if (dest?.location?.lat && dest?.location?.lng) {
      mapInstance.panTo({ lat: dest.location.lat, lng: dest.location.lng });
      mapInstance.setZoom(11);
    }
  }, [selectedDestId, mapInstance, routeData, destinations]);

  useEffect(() => {
    if (!mapInstance || !highlightedDestId) return;
    const destination = destinations.find((item) => (item._id || item.id) === highlightedDestId);
    if (destination?.location?.lat && destination?.location?.lng) {
      mapInstance.panTo({ lat: destination.location.lat, lng: destination.location.lng });
      mapInstance.setZoom(10);
    }
  }, [highlightedDestId, mapInstance, destinations]);

  useEffect(() => {
    if (plan) setShowTripSummary(true);
  }, [plan]);

  useEffect(() => {
    if (!awaitingDecision) {
      setPreviewRouteData(null);
      setHighlightedDestId(null);
    }
  }, [awaitingDecision]);

  // Active Destination Coordinates
  const currentDestDoc = destinations.find((d) => (d._id || d.id) === selectedDestId);
  const activeCenter = currentDestDoc?.location?.lat ? { lat: currentDestDoc.location.lat, lng: currentDestDoc.location.lng } : center;

  // Handle "Get Route" -> Geocode + Multi-stop Directions / POST /routes + GET /api/fare
  const handleFetchRoute = async (sourceOverride = source) => {
    const requestId = ++routeRequestIdRef.current;
    const isCurrentRequest = () => requestId === routeRequestIdRef.current;

    if (!sourceOverride || !selectedDestId) {
      setRouteData(null);
      return;
    }

    setIsFetchingRoute(true);
    setRouteError(null);

    try {
      // 1. Geocode origin address -> { lat, lng }
      let originCoords;
      if (useCurrentLocation && currentLocation) {
        originCoords = {
          lat: currentLocation.lat,
          lng: currentLocation.lng,
          formattedAddress: sourceOverride || 'Current location',
        };
      }
      try {
        if (!originCoords) {
          const geoRes = await api.get('/geocode', { params: { address: sourceOverride } });
          originCoords = geoRes.data?.data;
          if (!Number.isFinite(originCoords?.lat) || !Number.isFinite(originCoords?.lng)) {
            throw new Error(geoRes.data?.message || `Could not find location for '${sourceOverride}'`);
          }
        }
      } catch (backendGeocodeError) {
        if (!mapsSDK?.Geocoder) throw backendGeocodeError;
        originCoords = await new Promise((resolve, reject) => {
          const geocoder = new mapsSDK.Geocoder();
          geocoder.geocode({ address: sourceOverride }, (results, status) => {
            const location = results?.[0]?.geometry?.location;
            if (status !== 'OK' || !location) {
              reject(backendGeocodeError);
              return;
            }
            resolve({
              lat: location.lat(),
              lng: location.lng(),
              formattedAddress: results[0].formatted_address,
            });
          });
        });
      }

      // 2. Fetch destination list -> find destination lat/lng & name
      const dest = destinations.find((d) => (d._id || d.id) === selectedDestId);
      if (!dest?.location?.lat || !dest?.location?.lng) {
        throw new Error(`Destination coordinates missing for '${selectedDestId}'`);
      }
      const destCoords = { lat: dest.location.lat, lng: dest.location.lng };
      const destName = dest.displayName || dest.name || dest._id;

      // 3. Multi-stop route calculation via DirectionsService. Google Maps
      // rejects transit requests that contain intermediate waypoints
      // ("Exactly two waypoints required in transit requests"). Transit and
      // train routes therefore use the existing backend route flow below;
      // driving, walking and bike routes retain custom-stop support.
      const supportsDirectionsWaypoints = ['DRIVE', 'WALK', 'TWO_WHEELER'].includes(travelMode);
      if (mapsSDK?.DirectionsService && stops.length > 0 && supportsDirectionsWaypoints) {
        const directionsService = new mapsSDK.DirectionsService();
        const modeMap = {
          DRIVE: mapsSDK.TravelMode.DRIVING,
          TRANSIT: mapsSDK.TravelMode.TRANSIT,
          WALK: mapsSDK.TravelMode.WALKING,
          TWO_WHEELER: mapsSDK.TravelMode.DRIVING,
          TRAIN: mapsSDK.TravelMode.TRANSIT
        };

        const waypoints = stops.map((s) => ({
          location: s.lat && s.lng ? { lat: s.lat, lng: s.lng } : s.name,
          stopover: true
        }));

        const result = await new Promise((resolve) => {
          directionsService.route(
            {
              origin: { lat: originCoords.lat, lng: originCoords.lng },
              destination: { lat: destCoords.lat, lng: destCoords.lng },
              waypoints: waypoints,
              optimizeWaypoints: false,
              travelMode: modeMap[travelMode] || mapsSDK.TravelMode.DRIVING
            },
            (res, status) => {
              if (status === 'OK' && res?.routes?.[0]) resolve(res.routes[0]);
              else resolve(null);
            }
          );
        });

        if (result) {
          let totalDistMeters = 0;
          let totalDurationSec = 0;
          result.legs.forEach((leg) => {
            totalDistMeters += leg.distance?.value || 0;
            totalDurationSec += leg.duration?.value || 0;
          });

          const distanceKm = Math.round(totalDistMeters / 1000);
          const durationMinutes = Math.round(totalDurationSec / 60);

          const pathPoints = (result.overview_path || []).map((pt) => ({
            lat: pt.lat(),
            lng: pt.lng()
          }));

          let fareINR = Math.round(distanceKm * 12 + 200);

          if (!isCurrentRequest()) return;
          setRouteData({
            sourceName: originCoords.formattedAddress || sourceOverride,
            destName,
            originCoords: { lat: originCoords.lat, lng: originCoords.lng },
            destCoords,
            polyline: pathPoints,
            distanceKm,
            durationMinutes,
            fareINR,
            travelMode,
            hasCustomStops: true,
            stopsCount: stops.length
          });
          if (isCurrentRequest()) setIsFetchingRoute(false);
          return;
        }
      }

      const fareModeMap = { DRIVE: 'cab', TRANSIT: 'bus', TWO_WHEELER: 'auto' };

      if (travelMode === 'TRAIN') {
        if (!isCurrentRequest()) return;
        setRouteData({ sourceName: originCoords.formattedAddress || sourceOverride, destName, originCoords: { lat: originCoords.lat, lng: originCoords.lng }, destCoords, polyline: null, distanceKm: estimateIntercityDistanceKm(originCoords, destCoords), durationMinutes: null, fareINR: null, travelMode, isEstimated: true, estimateNote: 'Estimated intercity distance only — not an actual rail route.' });
        return;
      }

      if (travelMode === 'FLIGHT') {
        if (!isCurrentRequest()) return;
        setRouteData({ travelMode, isUnavailable: true, estimateNote: 'Flight distance/time not available — no flight data source is currently integrated.' });
        return;
      }

      const apiModeMap = {
        DRIVE: 'DRIVE',
        TRANSIT: 'TRANSIT',
        WALK: 'WALK',
        TWO_WHEELER: 'TWO_WHEELER'
      };
      const routeModeParam = apiModeMap[travelMode] || 'DRIVE';

      const routeRes = await api.post('/routes', {
        originLat: originCoords.lat,
        originLng: originCoords.lng,
        destLat: destCoords.lat,
        destLng: destCoords.lng,
        mode: routeModeParam
      });

      if (routeRes.data?.ok !== true || !routeRes.data?.data) {
        if (!isCurrentRequest()) return;
        setRouteData({
          sourceName: originCoords.formattedAddress || sourceOverride,
          destName,
          originCoords: { lat: originCoords.lat, lng: originCoords.lng },
          destCoords,
          distanceKm: null,
          durationMinutes: null,
          fareINR: null,
          travelMode,
          isUnavailable: true,
          estimateNote: 'No route data available for this mode over this distance.'
        });
        return;
      }

      const routeInfoData = routeRes.data?.data || {};
      const distanceKm = routeInfoData.distanceKm;
      const durationMinutes = routeInfoData.durationMinutes;

      // 4. Calculate realistic Inter-City Fares (in ₹ INR)
      let fareINR = null;
      let fareMeta = null;
      const fareMode = fareModeMap[travelMode];
      
      if (fareMode) {
        try {
          const cleanCity = (dest.city || dest._id || dest.name || dest.displayName || '').split(',')[0].trim();
          const fareRes = await api.get('/fare', { params: { city: cleanCity, mode: fareMode, distanceKm, durationMin: durationMinutes } });
          fareMeta = fareRes.data?.meta || null;
          if (fareRes.data?.ok === true && fareRes.data?.data?.fareINR != null) {
            fareINR = fareRes.data.data.fareINR;
          }
        } catch (err) {
          console.warn('[EverythingMap] City fare lookup fallback:', err.message);
        }
      }

      if (fareINR === null || fareINR === undefined) {
        if (travelMode === 'WALK') fareINR = 0;
        else if (travelMode === 'TRANSIT') fareINR = Math.round(distanceKm * 1.5);
        else if (travelMode === 'TWO_WHEELER') fareINR = Math.round(distanceKm * 3.2);
        else if (travelMode === 'DRIVE') fareINR = Math.round(distanceKm * 12 + 200);
      }

      if (!isCurrentRequest()) return;
      setRouteData({
        sourceName: originCoords.formattedAddress || sourceOverride,
        destName,
        originCoords: { lat: originCoords.lat, lng: originCoords.lng },
        destCoords,
        polyline: routeInfoData.polyline || null,
        distanceKm,
        durationMinutes,
        fareINR,
        fareMeta,
        travelMode,
        fareMode,
        estimateNote: null
      });
    } catch (err) {
      if (!isCurrentRequest()) return;
      console.error('[EverythingMap] Failed to fetch route:', err);
      setRouteError(err.message || 'Failed to calculate route');
    } finally {
      if (isCurrentRequest()) setIsFetchingRoute(false);
    }
  };

  // Auto-calculate route whenever destination, source, travelMode, or stops change
  useEffect(() => {
    if (debouncedSource && selectedDestId) {
      handleFetchRoute(debouncedSource);
    } else {
      setRouteData(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDestId, travelMode, debouncedSource, destinations, stops, useCurrentLocation]);

  // Sync center prop updates
  useEffect(() => {
    if (mapInstance && center) {
      mapInstance.panTo(center);
    }
  }, [center, mapInstance]);

  // (A reset effect keyed on plan.trip.summary used to live here. It could not
  // work reliably: re-planning the same destination produces an identical
  // summary string, so the dependency never changed and the card stayed
  // hidden. The dismissal flags are now derived from plan identity above.)

  useEffect(() => {
    if (mapInstance && typeof zoom === 'number') {
      mapInstance.setZoom(zoom);
    }
  }, [zoom, mapInstance]);

  const showSwapCard = swapOffers && !swapDismissed && !swapPreviewOpen && !awaitingDecision;
  const showSwapPreview = swapOffers && swapPreviewOpen && !awaitingDecision;
  const showTripPanel = plan && showTripSummary;
  const hasLeftPanels = showStopsPanel || showSwapCard || showTripPanel;
  const hasRightPanels = awaitingDecision || showSwapPreview || (plan && !awaitingDecision);
  const showRoutePanel = Boolean(routeData || isFetchingRoute);
  const showEmptyHint = !selectedDestId && !plan && !awaitingDecision && !showStopsPanel;

  return (
    <div ref={containerRef} className={`@container relative isolate bg-slate-100 ${className}`}>
      {/* Map Container Canvas */}
      {/* Absolutely filled: a percentage height on an in-flow child of a
          flex item doesn't resolve, which left the canvas stuck at its
          min-height while the overlay UI followed the real container size. */}
      <div ref={mapRef} className="map-canvas absolute inset-0 bg-slate-100" />

      {/* Map layers: these draw onto the Google Map and render no DOM of their own */}
      {mapInstance && mapsSDK && (
        <>
          <DestinationMarkersLayer
            map={mapInstance}
            mapsSDK={mapsSDK}
            selectedDestId={selectedDestId}
            highlightedDestId={highlightedDestId}
            onSelectDestination={setSelectedDestId}
          />
          <PressureHeatmapLayer map={mapInstance} mapsSDK={mapsSDK} date={startDate} visible={heatmapVisible} />
          {selectedDestId && (
            <CategoryMarkersLayer map={mapInstance} mapsSDK={mapsSDK} destId={selectedDestId} visibleCategories={visibleCategories} />
          )}
          <PlacesLayer
            map={mapInstance}
            mapsSDK={mapsSDK}
            center={activeCenter}
            visiblePlaces={visiblePlaces}
            onSelectHotel={setSelectedHotel}
            onAddStop={handleAddStop}
          />
          {routeData && <RoutePolylineLayer map={mapInstance} mapsSDK={mapsSDK} routeData={routeData} />}
          {currentLocation && <CurrentLocationLayer map={mapInstance} mapsSDK={mapsSDK} location={currentLocation} />}
          <StopMarkersLayer map={mapInstance} mapsSDK={mapsSDK} stops={stops} />
          {previewRouteData && <RoutePolylineLayer map={mapInstance} mapsSDK={mapsSDK} routeData={previewRouteData} />}
        </>
      )}

      {/*
        Floating UI. One layout owns every panel's position so nothing can
        overlap: command bar on top, then a row of
          [left dock: trip panels] [centre: toasts ... legend + route] [right dock: AI panels + tool rail]
        On narrow maps (container < @4xl) the row stacks vertically instead.
      */}
      {!loading && !error && (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col gap-3 p-3 @3xl:p-4">
          <div className="pointer-events-auto shrink-0">
            <MapControls
              source={source}
              useCurrentLocation={useCurrentLocation}
              onChangeSource={handleChangeSource}
              destId={selectedDestId}
              onChangeDestId={setSelectedDestId}
              startDate={startDate}
              onChangeStartDate={setStartDate}
              endDate={endDate}
              onChangeEndDate={setEndDate}
              budgetInr={budgetInr}
              onChangeBudgetInr={setBudgetInr}
              travellers={travellers}
              onChangeTravellers={setTravellers}
              travelMode={travelMode}
              onChangeTravelMode={setTravelMode}
              stopsCount={stops.length}
              showStopsPanel={showStopsPanel}
              onToggleStopsPanel={setShowStopsPanel}
              onDirectPlanTrip={handleDirectPlanTrip}
              isPlanning={isPlanning}
              plannerStage={plannerStage}
              onToggleCurrentLocation={toggleCurrentLocation}
            />
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3 @4xl:flex-row">
            {/* Left dock */}
            {hasLeftPanels && (
              <div className={`${DOCK_CLASS} max-h-[38vh] @4xl:max-h-none @4xl:w-[calc(340px+2rem)] @6xl:w-[calc(400px+2rem)]`}>
                {showStopsPanel && (
                  <StopPickerPanel
                    stops={stops}
                    onAddStop={handleAddStop}
                    onSearchAddStop={handleSearchAddStop}
                    isSearching={isSearchingStop}
                    onRemoveStop={handleRemoveStop}
                    onClearStops={handleClearStops}
                    onClose={() => setShowStopsPanel(false)}
                  />
                )}
                {showSwapCard && (
                  <div className="[&>*]:w-full!">
                    <SwapCard
                      data={{ swapOffers }}
                      onPreview={() => setSwapPreviewOpen(true)}
                      onApply={async () => {
                        setSwapDismissed(true);
                        await applySwap(swapOffers);
                      }}
                      onDismiss={() => setSwapDismissed(true)}
                    />
                  </div>
                )}
                {showTripPanel && (
                  <div className="mt-auto">
                    <TripSummaryPanel plan={plan} onClose={() => setShowTripSummary(false)} />
                  </div>
                )}
              </div>
            )}

            {/* Centre */}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-between gap-3">
              <div className="flex w-full flex-col items-center gap-2">
                {routeError && <MapToast onDismiss={() => setRouteError(null)}>{routeError}</MapToast>}
                {locationError && <MapToast tone="warning" onDismiss={() => setLocationError(null)}>{locationError}</MapToast>}
                {showEmptyHint && (
                  <p className="flex items-center gap-2 rounded-full border border-white/70 bg-white/90 px-3.5 py-1.5 text-[11px] font-semibold text-slate-600 shadow-md backdrop-blur-xl animate-fade-up">
                    <MousePointerClick size={14} className="shrink-0 text-[#6C63FF]" />
                    Choose a destination above, or tap any pin on the map
                  </p>
                )}
                {showStopsPanel && (
                  <p className="flex items-center gap-2 rounded-full bg-slate-950/85 px-3.5 py-1.5 text-[11px] font-semibold text-white shadow-md backdrop-blur-xl animate-fade-up">
                    <MapPinPlus size={14} className="shrink-0 text-amber-300" />
                    Click the map to drop a stop
                  </p>
                )}
              </div>
              <div className="flex w-full flex-col items-center gap-2 [&>*]:pointer-events-auto">
                {heatmapVisible && <PressureLegend />}
                {showRoutePanel && (
                  <RouteDetailsPanel
                    routeInfo={routeData}
                    stops={stops}
                    isLoading={isFetchingRoute}
                    onClose={() => setRouteData(null)}
                  />
                )}
              </div>
            </div>

            {/* Right dock */}
            <div className="flex min-h-0 shrink-0 flex-col items-end gap-3">
              {hasRightPanels && (
                <div className={`${DOCK_CLASS} max-h-[38vh] w-[calc(100%+2rem)] @4xl:max-h-none @4xl:w-[calc(340px+2rem)] @6xl:w-[calc(380px+2rem)]`}>
                  {awaitingDecision && (
                    <RecommendationOverlay onHighlight={setHighlightedDestId} onPreviewRoute={setPreviewRouteData} />
                  )}
                  {showSwapPreview && (
                    <RecommendationOverlay
                      swapOffers={swapOffers}
                      onHighlight={setHighlightedDestId}
                      onPreviewRoute={setPreviewRouteData}
                      onApplySwap={async (offers) => {
                        setSwapPreviewOpen(false);
                        setSwapDismissed(true);
                        await applySwap(offers);
                      }}
                      onClosePreview={() => setSwapPreviewOpen(false)}
                    />
                  )}
                  {plan && !awaitingDecision && (
                    <AIAssistantCard request={request} trip={plan.trip} onDownloadBrief={() => downloadTravelBrief(request, plan.trip)} />
                  )}
                </div>
              )}
              <div className="pointer-events-auto relative mt-auto">
                {layersOpen && (
                  <div className="absolute bottom-full right-0 mb-2 @4xl:bottom-0 @4xl:right-full @4xl:mb-0 @4xl:mr-2">
                    <LayerControls
                      hasDestination={Boolean(selectedDestId)}
                      visibleCategories={visibleCategories}
                      onToggle={handleToggleCategory}
                      visiblePlaces={visiblePlaces}
                      onTogglePlaces={handleTogglePlaces}
                      heatmapVisible={heatmapVisible}
                      onToggleHeatmap={setHeatmapVisible}
                      onClose={() => setLayersOpen(false)}
                    />
                  </div>
                )}
                <MapToolRail
                  map={mapInstance}
                  containerRef={containerRef}
                  homeCenter={center}
                  homeZoom={zoom}
                  locating={locationTracking}
                  onLocate={toggleFollowLocation}
                  layersOpen={layersOpen}
                  onToggleLayers={() => setLayersOpen((open) => !open)}
                  activeLayerCount={activeLayerCount}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Authentication Alert Modal */}
      {authAlert && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-slate-100 text-center animate-fade-up" role="dialog" aria-modal="true" aria-labelledby="map-auth-title">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 mb-3">
              <Lock size={24} />
            </div>
            <h3 id="map-auth-title" className="text-base font-extrabold text-slate-800">Log in to plan this trip</h3>
            <p className="mt-1 text-xs text-slate-500 font-medium">
              Your route and choices stay on the map. Log in to your Sahyatri account to create and save trip plans.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAuthAlert(false)}
                className="w-1/2 rounded-xl border border-slate-200 bg-slate-50 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
              >
                Not now
              </button>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="w-1/2 flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 py-2 text-xs font-bold text-white shadow-sm transition"
              >
                <LogIn size={14} />
                <span>Log in</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-white/80 px-6 py-5 shadow-sm">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#6C63FF] border-t-transparent" />
            <span className="text-xs font-semibold text-slate-600">Loading the map of India…</span>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {error && !loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 p-4">
          <div className="max-w-sm rounded-2xl border border-rose-200 bg-white p-5 text-center shadow-sm">
            <AlertTriangle size={22} className="mx-auto text-rose-500" />
            <p className="mt-2 text-sm font-bold text-slate-900">The map couldn&apos;t load</p>
            <p className="mt-1 text-xs text-slate-500">{error}</p>
            <button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-xl bg-slate-950 px-4 py-2 text-xs font-bold text-white transition hover:bg-[#6C63FF]">
              Try again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
