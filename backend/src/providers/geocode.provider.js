import { ok, fail } from '../lib/envelope.js';
import axios from 'axios';

function getGeocodeApiKeys() {
  const keys = [process.env.GOOGLE_GEOCODE_API_KEY, process.env.GOOGLE_MAPS_API_KEY];
  return Array.from(new Set(keys.filter(Boolean)));
}

export async function geocode(address) {
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
          return ok(
            {
              lat: result.geometry.location.lat,
              lng: result.geometry.location.lng,
              formattedAddress: result.formatted_address
            },
            { source: 'geocode', confidence: 'high' }
          );
        }
      } else {
        lastError = response.data.error_message || `Geocoding API status: ${response.data.status}`;
      }
    } catch (error) {
      lastError = error.response?.data?.error_message || error.message;
    }
  }

  return fail(lastError, { source: 'geocode' });
}