import crypto from "crypto";

/**
 * Proof-of-Visit (PoV) Cryptographic Helpers
 *
 * Implements 90-second rotating HMAC-SHA256 code generation for mutual attestation.
 * Prevents static QR code sharing by ensuring codes rotate dynamically.
 */

// Step window duration in seconds (90 seconds per specification)
export const STEP_DURATION_SECONDS = 90;

/**
 * Calculate the current 90-second time step.
 * @param {number} [timestampMs=Date.now()] - Timestamp in milliseconds.
 * @returns {number} The current integer step.
 */
export function getCurrentStep(timestampMs = Date.now()) {
  return Math.floor(timestampMs / 1000 / STEP_DURATION_SECONDS);
}

/**
 * Generate a 6-digit zero-padded HMAC-SHA256 PoV code for a business and step.
 *
 * Algorithm:
 * 1. message = `${businessId}:${step}`
 * 2. hmac = HMAC_SHA256(povSecret, message)
 * 3. decimal(digest[0..3]) % 1,000,000 -> 6 digits, zero-padded
 *
 * @param {string} povSecret - Secret key assigned to the business.
 * @param {string} businessId - Business string or ObjectId.
 * @param {number} step - Step index (floor(unixSeconds / 90)).
 * @returns {string} 6-digit code string.
 */
export function generatePovCode(povSecret, businessId, step) {
  if (!povSecret || !businessId || step === undefined || step === null) {
    throw new Error("povSecret, businessId, and step are required to generate PoV code");
  }

  const message = `${businessId.toString()}:${step}`;
  const hmac = crypto.createHmac("sha256", povSecret);
  hmac.update(message);
  const digest = hmac.digest();

  // Extract first 4 bytes as unsigned 32-bit big-endian integer
  const num = digest.readUInt32BE(0);
  const code = (num % 1000000).toString().padStart(6, "0");

  return code;
}

/**
 * Get valid PoV codes for current step and adjacent steps (step - 1, step, step + 1)
 * to absorb clock skew between devices.
 *
 * @param {string} povSecret - Secret key assigned to the business.
 * @param {string} businessId - Business ID.
 * @param {number} [currentStep] - Current step index. Defaults to system time step.
 * @returns {Array<{step: number, code: string}>} Array of valid step-code pairs.
 */
export function getValidPovCodes(povSecret, businessId, currentStep = getCurrentStep()) {
  const steps = [currentStep - 1, currentStep, currentStep + 1];
  return steps.map((step) => ({
    step,
    code: generatePovCode(povSecret, businessId, step),
  }));
}

/**
 * Validate an input PoV code against the clock-skew window (step - 1, step, step + 1).
 *
 * @param {string} povSecret - Secret key assigned to the business.
 * @param {string} businessId - Business ID.
 * @param {string} inputCode - 6-digit code provided by traveller.
 * @param {number} [currentStep] - Current step index.
 * @returns {{ valid: boolean, matchedStep: number|null }} Validation result.
 */
export function validatePovCode(povSecret, businessId, inputCode, currentStep = getCurrentStep()) {
  const cleanInput = String(inputCode).trim();
  const validCodes = getValidPovCodes(povSecret, businessId, currentStep);

  const match = validCodes.find((item) => item.code === cleanInput);
  if (match) {
    return { valid: true, matchedStep: match.step };
  }

  return { valid: false, matchedStep: null };
}
