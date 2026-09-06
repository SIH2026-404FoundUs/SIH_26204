/**
 * Proof-of-Visit (PoV) Fraud Validation Helpers
 *
 * Implements anti-fraud rules:
 * - Velocity check (> 200 km in under 1 hour)
 * - Self-referral & self-verification check
 * - Haversine geographic distance calculation
 */

// Velocity limits per specification: > 200 km within 1 hour
export const VELOCITY_MAX_DISTANCE_KM = 200;
export const VELOCITY_TIME_WINDOW_MS = 60 * 60 * 1000; // 1 hour in ms

/**
 * Calculate the great-circle distance between two points using the Haversine formula.
 *
 * @param {number} lat1 - Latitude of point 1 in degrees.
 * @param {number} lon1 - Longitude of point 1 in degrees.
 * @param {number} lat2 - Latitude of point 2 in degrees.
 * @param {number} lon2 - Longitude of point 2 in degrees.
 * @returns {number} Distance in kilometers.
 */
export function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees) {
  return (degrees * Math.PI) / 180;
}

/**
 * Check velocity constraint between previous verified visit and current attempt.
 * Rejects if user moved > 200 km within 1 hour.
 *
 * @param {Object|null} previousVisit - Previous visit record containing { verifiedAt, location: { lat, lng } }.
 * @param {{ lat: number, lng: number }|null} currentCoords - Current visit location coordinates.
 * @param {Date|number} [currentTimestamp=Date.now()] - Current server timestamp.
 * @returns {{ violated: boolean, distanceKm?: number, timeDeltaMinutes?: number }} Velocity check result.
 */
export function isVelocityViolated(previousVisit, currentCoords, currentTimestamp = Date.now()) {
  if (!previousVisit || !previousVisit.verifiedAt || !currentCoords) {
    return { violated: false };
  }

  const prevLat = previousVisit.location?.lat ?? previousVisit.lat;
  const prevLng = previousVisit.location?.lng ?? previousVisit.lng;
  const currLat = currentCoords.lat;
  const currLng = currentCoords.lng;

  if (prevLat === undefined || prevLng === undefined || currLat === undefined || currLng === undefined) {
    return { violated: false };
  }

  const prevTime = new Date(previousVisit.verifiedAt).getTime();
  const currTime = new Date(currentTimestamp).getTime();
  const timeDeltaMs = currTime - prevTime;

  // Velocity rule only applies to visits within the 1-hour window
  if (timeDeltaMs <= 0 || timeDeltaMs > VELOCITY_TIME_WINDOW_MS) {
    return { violated: false };
  }

  const distanceKm = calculateHaversineDistance(prevLat, prevLng, currLat, currLng);
  const timeDeltaMinutes = Math.round(timeDeltaMs / 60000);

  if (distanceKm > VELOCITY_MAX_DISTANCE_KM) {
    return {
      violated: true,
      distanceKm: Math.round(distanceKm * 10) / 10,
      timeDeltaMinutes,
    };
  }

  return { violated: false, distanceKm, timeDeltaMinutes };
}

/**
 * Check if the verification is a self-verification or self-referral.
 *
 * @param {string} userId - ID of the traveller attempting verification.
 * @param {string|null} businessOwnerUserId - User ID of the business owner.
 * @param {string|null} referrerUserId - User ID of the referrer (if applicable).
 * @returns {{ isSelf: boolean, reason?: string }} Self-referral check result.
 */
export function isSelfReferral(userId, businessOwnerUserId, referrerUserId = null) {
  const userStr = String(userId);

  // Self-verification check: traveller owns the business
  if (businessOwnerUserId && String(businessOwnerUserId) === userStr) {
    return { isSelf: true, reason: "POV_SELF_VERIFICATION_OWNER" };
  }

  // Self-referral check: referrer and referee are the same user
  if (referrerUserId && String(referrerUserId) === userStr) {
    return { isSelf: true, reason: "POV_SELF_REFERRAL_SAME_USER" };
  }

  return { isSelf: false };
}
