import { ok, fail } from '../lib/envelope.js';
import axios from 'axios';

function getApiKeys(preferGeocodeKey = false) {
  const keys = preferGeocodeKey
    ? [process.env.GOOGLE_GEOCODE_API_KEY, process.env.GOOGLE_MAPS_API_KEY]
    : [process.env.GOOGLE_MAPS_API_KEY, process.env.GOOGLE_GEOCODE_API_KEY];
  return Array.from(new Set(keys.filter(Boolean)));
}

async function searchPlaces(query, lat, lng, radiusMeters = 20000) {
  const keys = getApiKeys(false); // Key 1 primary for Places, Key 2 fallback
  let lastError = 'No API keys configured';

  for (const apiKey of keys) {
    try {
      const response = await axios.post(
        'https://places.googleapis.com/v1/places:searchText',
        {
          textQuery: query,
          locationBias: {
            circle: {
              center: { latitude: lat, longitude: lng },
              radius: radiusMeters
            }
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.rating'
          }
        }
      );

      const places = (response.data.places || []).map(p => ({
        placeId: p.id,
        name: p.displayName?.text,
        lat: p.location?.latitude,
        lng: p.location?.longitude,
        rating: p.rating
      }));

      return ok(places, { source: 'googlemaps', confidence: 'high' });
    } catch (error) {
      lastError = error.response?.data?.error?.message || error.message;
    }
  }

  return fail(lastError, { source: 'googlemaps' });
}

async function calculateRoute(originLat, originLng, destLat, destLng, mode = 'DRIVE') {
  const keys = getApiKeys(true); // Key 2 primary for Routes, Key 1 fallback
  let lastError = 'No API keys configured';

  for (const apiKey of keys) {
    try {
      const response = await axios.post(
        'https://routes.googleapis.com/directions/v2:computeRoutes',
        {
          origin: { location: { latLng: { latitude: originLat, longitude: originLng } } },
          destination: { location: { latLng: { latitude: destLat, longitude: destLng } } },
          travelMode: mode
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters'
          }
        }
      );

      const route = response.data.routes?.[0];
      if (!route) {
        return fail('No route found between these points', { source: 'googlemaps' });
      }

      const durationSeconds = parseInt(route.duration.replace('s', ''), 10);

      return ok(
        {
          distanceKm: route.distanceMeters / 1000,
          durationMinutes: Math.round(durationSeconds / 60)
        },
        { source: 'googlemaps', confidence: 'high' }
      );
    } catch (error) {
      lastError = error.response?.data?.error?.message || error.message;
    }
  }

  return fail(lastError, { source: 'googlemaps' });
}

export { searchPlaces, calculateRoute };

