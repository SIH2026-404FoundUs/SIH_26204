// Incentive Engine — bharani-tasks.md Section 2.1
//
// eligibleForDiscount(business, destId, date) =
//       business_availability.find({businessId, date, isOpen: true})
//   &&  pressure(destId, date).score < 0.30
//
// discountPct    = that availability row's discountPct, capped at 40
// effectivePrice = priceRangeINR.min * (1 - discountPct / 100)
//
// The trigger is declared availability, not predicted occupancy — a business
// onboarded 60 seconds ago with zero booking history must still be able to
// surface a discount. Never apply a discount the operator did not declare.

import BusinessAvailabilityModel from "../../models/businessAvailability.model.js";

const PRESSURE_THRESHOLD = 0.3;
const MAX_DISCOUNT_PCT = 40;

/**
 * Determines whether a business is eligible for an incentive discount on a given
 * date, and what that discount is worth.
 *
 * Not eligible whenever: no availability row exists for (businessId, date), the
 * row exists but isOpen is false, or the destination's pressure score for that
 * date is unknown (pressureFn returns null/undefined) or >= 0.30. In every
 * not-eligible case this returns full price with no discount — it never assumes
 * a default pressure score for an unscored destination.
 *
 * @param {Object} business - A Business document/plain object (needs _id and priceRangeINR.min).
 * @param {string} destId - Canonical destination slug (DESTINATIONS._id).
 * @param {string} date - "YYYY-MM-DD", matching both BUSINESS_AVAILABILITY.date and
 *   DESTINATION_PRESSURE.date.
 * @param {Function} [pressureFn] - (destId, date) => Promise<{score:number}|null>.
 *   Defaults to the real getPressure from services/pressure/service.js, called
 *   in-process (no HTTP round trip). That module is loaded via a dynamic
 *   import() *inside* this function body, on demand, rather than a static
 *   top-of-file import — pressure/service.js sits at the head of a much
 *   heavier subsystem (providers, seed loading, the precompute job), owned
 *   and actively being worked on by Sathvik, so this keeps eligibility.js
 *   fully isolated from it: production code that never overrides pressureFn
 *   still gets the real thing, but anything that always supplies a stub
 *   (i.e. every test in eligibility.test.js) never touches that import chain
 *   at all, however healthy or broken it currently is.
 * @returns {Promise<{ eligible: boolean, discountPct: number, effectivePrice: number }>}
 */
export async function eligibleForDiscount(business, destId, date, pressureFn) {
  const fullPrice = Number(business?.priceRangeINR?.min) || 0;
  const notEligible = { eligible: false, discountPct: 0, effectivePrice: fullPrice };

  const availabilityRow = await BusinessAvailabilityModel.findOne({
    businessId: business?._id,
    date,
    isOpen: true,
  }).lean();

  if (!availabilityRow) {
    return notEligible;
  }

  let getPressure = pressureFn;
  if (!getPressure) {
    ({ getPressure } = await import("../pressure/service.js"));
  }

  const pressureRow = await getPressure(destId, date);
  if (!pressureRow || typeof pressureRow.score !== "number" || pressureRow.score >= PRESSURE_THRESHOLD) {
    return notEligible;
  }

  // Defensive clamp — don't trust a bad availability row blindly, even though
  // the schema itself already enforces discountPct <= 40.
  const rawDiscountPct = Number(availabilityRow.discountPct) || 0;
  const discountPct = Math.max(0, Math.min(rawDiscountPct, MAX_DISCOUNT_PCT));
  const effectivePrice = fullPrice * (1 - discountPct / 100);

  return { eligible: true, discountPct, effectivePrice };
}
