import { ok, fail } from '../lib/envelope.js';
import axios from 'axios';

async function searchPlaces(query, lat, lng, radiusMeters = 20000) {
  try {
    // Google's "New Places API" uses POST, not GET, and wants the
    // location bias sent as a circle: a center point + a radius
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
          'X-Goog-Api-Key': process.env.GOOGLE_MAPS_API_KEY,
          // this tells Google exactly which fields to send back —
          // without this header, the New Places API returns almost nothing
          'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.rating'
        }
      }
    );

    // response.data.places might not exist if nothing matched — handle that
    const places = (response.data.places || []).map(p => ({
      placeId: p.id,
      name: p.displayName?.text,
      lat: p.location?.latitude,
      lng: p.location?.longitude,
      rating: p.rating
    }));

    return ok(places, { source: 'googlemaps', confidence: 'high' });

  } catch (error) {
    const message = error.response?.data?.error?.message || error.message;
    return fail(message, { source: 'googlemaps' });
  }
}


async function calculateRoute(originLat, originLng, destLat, destLng, mode = 'DRIVE') {
  try {
    const response = await axios.post(
      'https://routes.googleapis.com/directions/v2:computeRoutes',
      {
        origin: { location: { latLng: { latitude: originLat, longitude: originLng } } },
        destination: { location: { latLng: { latitude: destLat, longitude: destLng } } },
        travelMode: mode   // DRIVE | WALK | BICYCLE | TRANSIT
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': process.env.GOOGLE_MAPS_API_KEY,
          // Routes API also needs an explicit field mask, same rule as Places
          'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters'
        }
      }
    );

    const route = response.data.routes?.[0];
    if (!route) {
      return fail('No route found between these points', { source: 'googlemaps' });
    }

    // duration comes back as a string like "1234s" — strip the "s" and convert
    const durationSeconds = parseInt(route.duration.replace('s', ''), 10);

    return ok(
      {
        distanceKm: route.distanceMeters / 1000,
        durationMinutes: Math.round(durationSeconds / 60)
      },
      { source: 'googlemaps', confidence: 'high' }
    );

  } catch (error) {
    const message = error.response?.data?.error?.message || error.message;
    return fail(message, { source: 'googlemaps' });
  }
}

export { searchPlaces,calculateRoute };



// node
// require('dotenv').config()
// const { searchPlaces } = require('./src/providers/googlemaps.provider')
