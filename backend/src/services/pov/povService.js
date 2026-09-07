import {
  getCurrentStep,
  generatePovCode,
  getValidPovCodes,
  validatePovCode,
} from "./povCrypto.js";
import {
  isVelocityViolated,
  isSelfReferral,
  calculateHaversineDistance,
} from "./povValidation.js";

/**
 * Proof-of-Visit (PoV) Service
 *
 * Core business logic for mutual attestation proof-of-visit verification.
 * Implements the full 8-step verification pipeline, anti-replay guarantee,
 * velocity limits, self-referral checks, and audit logging.
 */

/**
 * Audit log helper function.
 * Attempts to record audit log entry if AuditLog model is provided.
 */
async function recordAuditLog(AuditLogModel, { actor, action, target, reasonCode, meta }) {
  if (!AuditLogModel) return;
  try {
    await AuditLogModel.create({
      actor: String(actor || "system"),
      action,
      target: String(target || ""),
      reasonCode,
      meta: meta || {},
      at: new Date(),
    });
  } catch (err) {
    console.error(`[PoV AuditLog Error] Failed to write audit log for ${action}:`, err.message);
  }
}

/**
 * Main Proof-of-Visit Verification Pipeline
 *
 * @param {Object} params - Verification parameters.
 * @param {string} params.userId - Traveller user ID.
 * @param {string} params.businessId - Target business ID.
 * @param {string} params.code - 6-digit code submitted by traveller.
 * @param {{ lat: number, lng: number }} [params.currentLocation] - Optional current coordinates.
 * @param {string} [params.referrerId] - Optional referrer user ID.
 * @param {string} [params.originalDestId] - Optional original destination ID before redirection.
 *
 * @param {Object} [models] - Database models (for dependency injection / testing).
 * @param {Object} [models.BusinessModel] - Mongoose Business model.
 * @param {Object} [models.VisitModel] - Mongoose Visit model.
 * @param {Object} [models.AuditLogModel] - Mongoose AuditLog model.
 *
 * @returns {Promise<Object>} Verification result object.
 */
export async function verifyVisit(params, models = {}) {
  const { userId, businessId, code, currentLocation, referrerId, originalDestId } = params;
  const { BusinessModel, VisitModel, AuditLogModel } = models;

  // Basic argument validation
  if (!userId || !businessId || !code) {
    return {
      status: "rejected",
      reasonCode: "POV_MISSING_PARAMETERS",
      message: "userId, businessId, and code are required",
      code: 400,
    };
  }

  // Step 1: Resolve business and verify povSecret exists.
  // povSecret has `select: false` on the schema, so it must be re-selected
  // explicitly here or every verification fails with POV_SECRET_MISSING.
  let business = null;
  if (BusinessModel) {
    business = await BusinessModel.findById(businessId).select("+povSecret");
  }

  if (!business) {
    await recordAuditLog(AuditLogModel, {
      actor: userId,
      action: "pov.verify.reject",
      target: businessId,
      reasonCode: "POV_BUSINESS_NOT_FOUND",
      meta: { code },
    });
    return {
      status: "rejected",
      reasonCode: "POV_BUSINESS_NOT_FOUND",
      message: "Target business not found",
      code: 404,
    };
  }

  const povSecret = business.povSecret;
  if (!povSecret) {
    await recordAuditLog(AuditLogModel, {
      actor: userId,
      action: "pov.verify.reject",
      target: businessId,
      reasonCode: "POV_SECRET_MISSING",
      meta: { businessId },
    });
    return {
      status: "rejected",
      reasonCode: "POV_SECRET_MISSING",
      message: "Business does not have a PoV secret configured",
      code: 500,
    };
  }

  // Step 2: Recompute valid codes for step-1, step, step+1 and match
  const currentStep = getCurrentStep();
  const { valid: isCodeValid, matchedStep } = validatePovCode(povSecret, businessId, code, currentStep);

  if (!isCodeValid) {
    await recordAuditLog(AuditLogModel, {
      actor: userId,
      action: "pov.verify.reject",
      target: businessId,
      reasonCode: "POV_CODE_MISMATCH",
      meta: { inputCode: code, step: currentStep },
    });

    return {
      status: "rejected",
      reasonCode: "POV_CODE_MISMATCH",
      message: "Invalid or expired proof-of-visit code",
      code: 400,
    };
  }

  // Step 3: Anti-replay check — reject if (userId, businessId, codeStep) already exists
  if (VisitModel) {
    const existingVisit = await VisitModel.findOne({
      userId,
      businessId,
      codeStep: matchedStep,
      status: "verified",
    });

    if (existingVisit) {
      await recordAuditLog(AuditLogModel, {
        actor: userId,
        action: "pov.verify.reject",
        target: businessId,
        reasonCode: "POV_REPLAY_DETECTED",
        meta: { existingVisitId: existingVisit._id, codeStep: matchedStep },
      });

      return {
        status: "rejected",
        reasonCode: "POV_REPLAY_DETECTED",
        message: "This proof-of-visit code has already been redeemed for this time step",
        code: 409,
      };
    }
  }

  // Step 4: Velocity check — reject if user has a verified visit > 200 km away within 1 hour
  if (VisitModel && currentLocation) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const query = VisitModel.findOne({
      userId,
      status: "verified",
      verifiedAt: { $gte: oneHourAgo },
    });

    const previousVisit = query && typeof query.sort === "function" ? await query.sort({ verifiedAt: -1 }) : await query;

    if (previousVisit) {
      const velocityCheck = isVelocityViolated(previousVisit, currentLocation);
      if (velocityCheck.violated) {
        await recordAuditLog(AuditLogModel, {
          actor: userId,
          action: "pov.verify.reject",
          target: businessId,
          reasonCode: "POV_VELOCITY_EXCEEDED",
          meta: {
            distanceKm: velocityCheck.distanceKm,
            timeDeltaMinutes: velocityCheck.timeDeltaMinutes,
          },
        });

        return {
          status: "rejected",
          reasonCode: "POV_VELOCITY_EXCEEDED",
          message: `Impossible travel velocity: ${velocityCheck.distanceKm} km in ${velocityCheck.timeDeltaMinutes} min`,
          code: 400,
        };
      }
    }
  }

  // Step 5: Self-referral / self-verification check
  const ownerId = business.ownerUserId || business.userId;
  const selfCheck = isSelfReferral(userId, ownerId, referrerId);
  if (selfCheck.isSelf) {
    await recordAuditLog(AuditLogModel, {
      actor: userId,
      action: "pov.verify.reject",
      target: businessId,
      reasonCode: selfCheck.reason,
      meta: { ownerId, referrerId },
    });

    return {
      status: "rejected",
      reasonCode: selfCheck.reason,
      message: "Self-verification or self-referral is not permitted",
      code: 400,
    };
  }

  // Step 6: Write the visits document
  let newVisit = null;
  if (VisitModel) {
    newVisit = await VisitModel.create({
      userId,
      businessId,
      destId: business.destId,
      originalDestId: originalDestId || business.destId,
      method: "rotating-code",
      codeStep: matchedStep,
      status: "verified",
      verifiedAt: new Date(),
      ...(currentLocation ? { location: currentLocation } : {}),
    });
  } else {
    // In-memory fallback if VisitModel not passed
    newVisit = {
      _id: "in_memory_" + Date.now(),
      userId,
      businessId,
      destId: business.destId,
      codeStep: matchedStep,
      status: "verified",
      verifiedAt: new Date(),
    };
  }

  // Step 7: Recompute business verificationTier and increment visitCount
  business.visitCount = (business.visitCount || 0) + 1;

  // Upgrade verification tier if currently self-declared
  if (!business.verificationTier || business.verificationTier === "self-declared") {
    business.verificationTier = "visit-verified";
  }

  if (typeof business.save === "function") {
    await business.save();
  }

  // Step 8: Log audit accept and return result
  await recordAuditLog(AuditLogModel, {
    actor: userId,
    action: "pov.verify.accept",
    target: String(newVisit._id),
    reasonCode: "POV_VERIFIED",
    meta: {
      businessId,
      codeStep: matchedStep,
      tierAfter: business.verificationTier,
      visitCount: business.visitCount,
    },
  });

  return {
    status: "verified",
    visitId: newVisit._id,
    businessId: business._id || businessId,
    destId: business.destId,
    tierAfter: business.verificationTier,
    visitCount: business.visitCount,
    codeStep: matchedStep,
    verifiedAt: newVisit.verifiedAt,
  };
}

/**
 * Generate current 6-digit operator display code for a business.
 * Used by business operator console or WhatsApp bot to display to traveller.
 *
 * @param {string} povSecret - Secret assigned to the business.
 * @param {string} businessId - Business ID.
 * @returns {{ code: string, step: number, expiresInSeconds: number }} Operator code info.
 */
export function generateCurrentOperatorCode(povSecret, businessId) {
  const currentStep = getCurrentStep();
  const code = generatePovCode(povSecret, businessId, currentStep);

  const nowSeconds = Math.floor(Date.now() / 1000);
  const nextStepTime = (currentStep + 1) * 90;
  const expiresInSeconds = nextStepTime - nowSeconds;

  return {
    code,
    step: currentStep,
    expiresInSeconds,
  };
}

/**
 * Check if a user has at least one verified visit (used as gate for Community Discovery).
 *
 * @param {string} userId - Traveller user ID.
 * @param {Object} VisitModel - Mongoose Visit model.
 * @returns {Promise<boolean>} True if user has >= 1 verified visit.
 */
export function hasUserVerifiedVisits(userId, VisitModel) {
  if (!userId || !VisitModel) return Promise.resolve(false);
  return VisitModel.exists({ userId, status: "verified" }).then((res) => !!res);
}

/**
 * Get total verified visit count for a user.
 *
 * @param {string} userId - Traveller user ID.
 * @param {Object} VisitModel - Mongoose Visit model.
 * @returns {Promise<number>} Total count of verified visits.
 */
export function getUserVerifiedVisitCount(userId, VisitModel) {
  if (!userId || !VisitModel) return Promise.resolve(0);
  return VisitModel.countDocuments({ userId, status: "verified" });
}
