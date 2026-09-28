// backend/src/services/travelTime.js
import { calculateRoute } from '../providers/googlemaps.provider.js';
import { geocode } from '../providers/geocode.provider.js';
import { getDestination } from './pressure/seed.js';

export async function travelTimeFn(origin, destId) {
  const originLocation = await geocode(origin);
  if (!originLocation.ok) return null;

  const destination = getDestination(destId);   // note: NOT async, no await needed
  if (!destination) return null;

  const result = await calculateRoute(
    originLocation.data.lat, originLocation.data.lng,
    destination.lat, destination.lng
  );
  if (!result.ok) return null;

  return result.data.durationMinutes / 60;
}