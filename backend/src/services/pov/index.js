/**
 * Proof-of-Visit (PoV) Service Module
 *
 * Exposes core PoV verification, 90-second rotating HMAC code generation,
 * fraud checks (anti-replay, velocity, self-referral), and community gate helpers.
 */

export {
  verifyVisit,
  generateCurrentOperatorCode,
  hasUserVerifiedVisits,
  getUserVerifiedVisitCount,
} from "./povService.js";

export {
  getCurrentStep,
  generatePovCode,
  getValidPovCodes,
  validatePovCode,
  STEP_DURATION_SECONDS,
} from "./povCrypto.js";

export {
  calculateHaversineDistance,
  isVelocityViolated,
  isSelfReferral,
  VELOCITY_MAX_DISTANCE_KM,
  VELOCITY_TIME_WINDOW_MS,
} from "./povValidation.js";
