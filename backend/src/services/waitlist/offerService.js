/**
 * SmartWaitlist Offer & Atomic Claim Service
 *
 * Implements shared OFFERS collection logic with atomic claim execution.
 * Prevents race conditions when multiple waitlisted tourists claim the same opening.
 */

/**
 * Create a new open offer for a business slot/cancellation.
 *
 * @param {Object} offerData - Offer parameters.
 * @param {string} offerData.businessId - Business ID offering the slot.
 * @param {string} offerData.destId - Destination ID (canonical slug, e.g. "shimla").
 * @param {Date|string} offerData.date - Date/time of the open slot.
 * @param {number} [offerData.originalPrice] - Original price in INR.
 * @param {number} [offerData.discountPct=0] - Discount percentage (0-100).
 * @param {number} [offerData.durationMinutes=15] - Offer validity window in minutes.
 * @param {Object} [models] - Database models (OfferModel).
 * @returns {Promise<Object>} Created offer object.
 */
export async function createOffer(offerData, models = {}) {
  const { OfferModel } = models;
  const {
    businessId,
    destId,
    date,
    originalPrice = 0,
    discountPct = 0,
    durationMinutes = 15,
  } = offerData;

  if (!businessId || !destId || !date) {
    throw new Error("businessId, destId, and date are required to create an offer");
  }

  const effectivePrice = Math.round(originalPrice * (1 - discountPct / 100));
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + durationMinutes * 60 * 1000);

  const newOfferData = {
    businessId,
    destId,
    date: new Date(date),
    originalPrice,
    discountPct,
    effectivePrice,
    status: "open",
    claimedBy: null,
    claimedAt: null,
    expiresAt,
    createdAt,
  };

  if (OfferModel) {
    const offerDoc = await OfferModel.create(newOfferData);
    return offerDoc;
  }

  return {
    _id: "offer_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
    ...newOfferData,
  };
}

/**
 * Execute Atomic Claim on an Offer.
 *
 * Uses findOneAndUpdate with status="open" and expiresAt > now criteria.
 * Guarantees that in concurrent bursts, EXACTLY ONE claimant wins and all others get 409.
 *
 * @param {string} offerId - Target offer ID.
 * @param {string} userId - Claimant tourist user ID.
 * @param {Object} [models] - Mongoose models (OfferModel, WaitlistModel, AuditLogModel).
 * @returns {Promise<{ success: boolean, status: number, offer?: Object, error?: string, message?: string }>} Claim result.
 */
export async function claimOfferAtomic(offerId, userId, models = {}) {
  const { OfferModel, WaitlistModel, AuditLogModel } = models;

  if (!offerId || !userId) {
    return {
      success: false,
      status: 400,
      error: "invalid_params",
      message: "offerId and userId are required",
    };
  }

  const now = new Date();

  let wonOffer = null;
  if (OfferModel) {
    // Atomic lock using Mongoose / MongoDB findOneAndUpdate
    wonOffer = await OfferModel.findOneAndUpdate(
      {
        _id: offerId,
        status: "open",
        expiresAt: { $gt: now },
      },
      {
        $set: {
          status: "claimed",
          claimedBy: userId,
          claimedAt: now,
        },
      },
      { new: true, returnDocument: "after" }
    );
  }

  // If offer was already claimed or expired
  if (!wonOffer) {
    if (AuditLogModel && typeof AuditLogModel.create === "function") {
      await AuditLogModel.create({
        actor: String(userId),
        action: "offer.claim.failed",
        target: String(offerId),
        reasonCode: "OFFER_ALREADY_CLAIMED_OR_EXPIRED",
        at: now,
      }).catch(() => {});
    }

    return {
      success: false,
      status: 409,
      error: "already_claimed",
      message: "Offer has already been claimed or has expired",
    };
  }

  // Update waitlist entry status for the winning user
  if (WaitlistModel && typeof WaitlistModel.updateOne === "function") {
    await WaitlistModel.updateOne(
      {
        userId,
        destId: wonOffer.destId,
        state: "waiting",
      },
      {
        $set: {
          state: "fulfilled",
          fulfilledAt: now,
          claimedOfferId: wonOffer._id,
        },
      }
    ).catch(() => {});
  }

  // Audit log success
  if (AuditLogModel && typeof AuditLogModel.create === "function") {
    await AuditLogModel.create({
      actor: String(userId),
      action: "offer.claim.success",
      target: String(wonOffer._id),
      reasonCode: "OFFER_CLAIMED",
      meta: { businessId: wonOffer.businessId, destId: wonOffer.destId },
      at: now,
    }).catch(() => {});
  }

  return {
    success: true,
    status: 200,
    offer: wonOffer,
  };
}

/**
 * Scheduled job helper to flip open offers past expiresAt to "expired".
 *
 * @param {Object} [models] - Database models (OfferModel).
 * @param {Date} [now=new Date()] - Reference timestamp.
 * @returns {Promise<{ expiredCount: number }>} Result summary.
 */
export async function expireOffersJob(models = {}, now = new Date()) {
  const { OfferModel } = models;

  if (!OfferModel || typeof OfferModel.updateMany !== "function") {
    return { expiredCount: 0 };
  }

  const result = await OfferModel.updateMany(
    {
      status: "open",
      expiresAt: { $lte: now },
    },
    {
      $set: { status: "expired" },
    }
  );

  return { expiredCount: result.modifiedCount || result.nModified || 0 };
}
