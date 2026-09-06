import { ok, fail } from '../lib/envelope.js';
import axios from 'axios';

export async function geocode(address) {
  try {
    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/geocode/json',
      {
        params: {
          address,
          key: process.env.GOOGE_GEOCODE_API_KEY
        }
      }
    );

    const result = response.data.results?.[0];
    if (!result) {
      return fail(`No location found for: ${address}`, { source: 'geocode' });
    }

    return ok(
      {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        formattedAddress: result.formatted_address
      },
      { source: 'geocode', confidence: 'high' }
    );

  } catch (error) {
    const message = error.response?.data?.error_message || error.message;
    return fail(message, { source: 'geocode' });
  }
}