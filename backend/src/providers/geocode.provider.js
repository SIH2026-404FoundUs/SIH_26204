import { ok, fail } from '../lib/envelope.js';
import axios from 'axios';
import { createTtlCache } from '../lib/ttlCache.js';

const GEOCODE_TTL_MS = 60 * 60 * 1000; // 1 hour TTL
const geocodeCache = createTtlCache({ ttlMs: GEOCODE_TTL_MS, maxEntries: 500 });

function getGeocodeApiKeys() {
  const keys = [process.env.GOOGLE_GEOCODE_API_KEY, process.env.GOOGLE_MAPS_API_KEY];
  return Array.from(new Set(keys.filter(Boolean)));
}

export async function geocode(address) {
  if (!address || typeof address !== 'string') {
    return fail('Valid address string required', { source: 'geocode' });
  }

  const cacheKey = address.trim().toLowerCase();
  const cached = geocodeCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const keys = getGeocodeApiKeys();
  let lastError = `No location found for: ${address}`;

  for (const apiKey of keys) {
    try {
      const response = await axios.get(
        'https://maps.googleapis.com/maps/api/geocode/json',
        {
          params: {
            address,
            key: apiKey
          }
        }
      );

      if (response.data.status === 'OK') {
        const result = response.data.results?.[0];
        if (result) {
          const resObj = ok(
            {
              lat: result.geometry.location.lat,
              lng: result.geometry.location.lng,
              formattedAddress: result.formatted_address
            },
            { source: 'geocode', confidence: 'high' }
          );
          return geocodeCache.set(cacheKey, resObj);
        }
      } else {
        lastError = response.data.error_message || `Geocoding API status: ${response.data.status}`;
      }
    } catch (error) {
      lastError = error.response?.data?.error_message || error.message;
    }
  }

  const failResult = fail(lastError, { source: 'geocode' });
  return geocodeCache.set(cacheKey, failResult);
}