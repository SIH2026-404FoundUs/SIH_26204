import { ok, fail } from '../lib/envelope.js';
import axios from 'axios';
import { createTtlCache } from '../lib/ttlCache.js';
import { uniqueKeys } from '../lib/apiKeys.js';

// Text Search is the expensive call in this file, and a trip plan re-runs the
// same two queries ("hotels in X", "tourist attractions in X") for the same
// destination on every plan, preview and confirm. Ten minutes is long enough
// to collapse one traveller's whole session into a single billed search, and
// short enough that ratings/opening data are not visibly stale.
const SEARCH_TTL_MS = 10 * 60 * 1000;
const searchCache = createTtlCache({ ttlMs: SEARCH_TTL_MS, maxEntries: 300 });

// Photo bytes are immutable for a given photo name, so they are cached far
// longer, capped by total size rather than by count — one 800px JPEG is
// ~100-200KB and an uncapped cache would be a slow memory leak.
const PHOTO_TTL_MS = 24 * 60 * 60 * 1000;
const PHOTO_CACHE_MAX_BYTES = 32 * 1024 * 1024;
const photoCache = createTtlCache({
  ttlMs: PHOTO_TTL_MS,
  maxEntries: 300,
  maxBytes: PHOTO_CACHE_MAX_BYTES,
  sizeOf: (photo) => photo?.data?.byteLength ?? photo?.data?.length ?? 0,
});

// Coordinates arrive from map interactions as well as from stored destination
// records, so round before keying: a few metres of drift must not miss the
// cache. Three decimal places is roughly 110m.
function searchCacheKey(query, lat, lng, radiusMeters) {
  const round = (value) => (Number.isFinite(value) ? value.toFixed(3) : String(value));
  return `${String(query).trim().toLowerCase()}|${round(lat)}|${round(lng)}|${radiusMeters}`;
}

function getApiKeys(preferGeocodeKey = false) {
  return uniqueKeys(preferGeocodeKey
    ? [process.env.GOOGLE_GEOCODE_API_KEY, process.env.GOOGLE_MAPS_API_KEY]
    : [process.env.GOOGLE_MAPS_API_KEY, process.env.GOOGLE_GEOCODE_API_KEY]);
}

async function searchPlaces(query, lat, lng, radiusMeters = 20000) {
  const cacheKey = searchCacheKey(query, lat, lng, radiusMeters);
  const cached = searchCache.get(cacheKey);
  if (cached) return cached;

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
          'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.rating,places.photos'
          }
        }
      );

      const places = (response.data.places || []).map(p => ({
        placeId: p.id,
        name: p.displayName?.text,
        lat: p.location?.latitude,
        lng: p.location?.longitude,
        rating: p.rating,
        photoName: p.photos?.[0]?.name || null
      }));

      // Only successes are cached: a failure here is usually a quota or key
      // problem that the very next request should be free to retry.
      return searchCache.set(cacheKey, ok(places, { source: 'googlemaps', confidence: 'high' }));
    } catch (error) {
      lastError = error.response?.data?.error?.message || error.message;
    }
  }

  return fail(lastError, { source: 'googlemaps' });
}

async function getPlacePhoto(photoName, maxWidthPx = 800) {
  const cacheKey = `${photoName}|${maxWidthPx}`;
  const cached = photoCache.get(cacheKey);
  if (cached) return cached;

  const keys = getApiKeys(false);
  let lastError = 'No API keys configured';
  for (const apiKey of keys) {
    try {
      const response = await axios.get(`https://places.googleapis.com/v1/${photoName}/media`, {
        params: { maxWidthPx },
        headers: { 'X-Goog-Api-Key': apiKey },
        responseType: 'arraybuffer',
        maxRedirects: 5,
      });
      return photoCache.set(cacheKey, {
        data: response.data,
        contentType: response.headers['content-type'] || 'image/jpeg',
      });
    } catch (error) {
      lastError = error.response?.data?.error?.message || error.message;
    }
  }
  throw new Error(lastError);
}

const ROUTE_TTL_MS = 60 * 60 * 1000; // 1 hour TTL
const routeCache = createTtlCache({ ttlMs: ROUTE_TTL_MS, maxEntries: 1000 });

function routeCacheKey(originLat, originLng, destLat, destLng, mode) {
  const round = (val) => (Number.isFinite(val) ? val.toFixed(3) : String(val));
  return `${round(originLat)}|${round(originLng)}|${round(destLat)}|${round(destLng)}|${mode}`;
}

async function calculateRoute(originLat, originLng, destLat, destLng, mode = 'DRIVE') {
  const cacheKey = routeCacheKey(originLat, originLng, destLat, destLng, mode);
  const cached = routeCache.get(cacheKey);
  if (cached) return cached;

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
            'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline'
          }
        }
      );

      const route = response.data.routes?.[0];
      if (!route) {
        const failRes = fail('No route found between these points', { source: 'googlemaps' });
        return routeCache.set(cacheKey, failRes);
      }

      const durationSeconds = parseInt(route.duration.replace('s', ''), 10);

      const okRes = ok(
        {
          distanceKm: route.distanceMeters / 1000,
          durationMinutes: Math.round(durationSeconds / 60),
          polyline: route.polyline?.encodedPolyline || null
        },
        { source: 'googlemaps', confidence: 'high' }
      );
      return routeCache.set(cacheKey, okRes);
    } catch (error) {
      lastError = error.response?.data?.error?.message || error.message;
    }
  }

  const failRes = fail(lastError, { source: 'googlemaps' });
  return routeCache.set(cacheKey, failRes);
}

export { searchPlaces, getPlacePhoto, calculateRoute };
