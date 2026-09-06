import crypto from "crypto";

/**
 * Shareable Trip Record Service
 *
 * Provides safe, revocable, read-only trip sharing projections.
 * Eliminates unnecessary PII (contact details, payments, passwords) from shared trip links.
 */

export const DEFAULT_SHARE_EXPIRATION_DAYS = 7;

/**
 * Create a new read-only shareable trip record token.
 *
 * @param {Object} params - Trip share parameters.
 * @param {string} params.tripId - Original trip ID.
 * @param {string} params.userId - Owner user ID.
 * @param {string} [params.title] - Trip title.
 * @param {string} params.destId - Destination slug.
 * @param {Date|string} [params.startDate] - Start date.
 * @param {Date|string} [params.endDate] - End date.
 * @param {Array<Object>} [params.stops] - Read-only itinerary stops.
 * @param {number} [params.expirationDays=7] - Token validity window in days.
 *
 * @param {Object} [models] - Database models (ShareableTripModel, AuditLogModel).
 * @returns {Promise<Object>} Created shareable record with shareToken.
 */
export async function createShareableTripRecord(params, models = {}) {
  const { ShareableTripModel, AuditLogModel } = models;
  const {
    tripId,
    userId,
    title = "My Trip Itinerary",
    destId,
    startDate,
    endDate,
    stops = [],
    expirationDays = DEFAULT_SHARE_EXPIRATION_DAYS,
  } = params;

  if (!tripId || !userId || !destId) {
    throw new Error("tripId, userId, and destId are required to create a shareable trip record");
  }

  // Generate 32-character random token
  const shareToken = crypto.randomBytes(16).toString("hex");

  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + expirationDays * 24 * 60 * 60 * 1000);

  // Read-only PII-minimized projection
  const shareableProjection = {
    shareToken,
    tripId: String(tripId),
    userId: String(userId),
    title: String(title).trim(),
    destId: String(destId).toLowerCase().trim(),
    startDate: startDate ? new Date(startDate) : null,
    endDate: endDate ? new Date(endDate) : null,
    stops: stops.map((s) => ({
      name: s.name || s.title,
      location: s.location || { lat: s.lat, lng: s.lng },
      dayIndex: s.dayIndex ?? 1,
    })),
    isRevoked: false,
    expiresAt,
    createdAt,
  };

  let savedDoc = null;
  if (ShareableTripModel && typeof ShareableTripModel.create === "function") {
    savedDoc = await ShareableTripModel.create(shareableProjection);
  } else {
    savedDoc = {
      _id: "share_" + Date.now(),
      ...shareableProjection,
    };
  }

  if (AuditLogModel && typeof AuditLogModel.create === "function") {
    await AuditLogModel.create({
      actor: String(userId),
      action: "trip.share.token_created",
      target: String(tripId),
      reasonCode: "SHAREABLE_LINK_GENERATED",
      meta: { shareToken, expiresAt },
      at: createdAt,
    }).catch(() => {});
  }

  return {
    success: true,
    shareToken: savedDoc.shareToken,
    expiresAt: savedDoc.expiresAt,
    record: savedDoc,
  };
}

/**
 * Retrieve a read-only trip projection via shareToken.
 *
 * @param {string} shareToken - 32-character random token.
 * @param {Object} [models] - Database models (ShareableTripModel).
 * @returns {Promise<Object>} Read-only trip data or error.
 */
export async function getShareableTripRecord(shareToken, models = {}) {
  const { ShareableTripModel } = models;
  if (!shareToken) {
    return { success: false, status: 400, error: "MISSING_SHARE_TOKEN" };
  }

  let record = null;
  if (ShareableTripModel && typeof ShareableTripModel.findOne === "function") {
    record = await ShareableTripModel.findOne({ shareToken });
  }

  if (!record) {
    return { success: false, status: 404, error: "SHARE_TOKEN_NOT_FOUND", message: "Invalid or expired share token" };
  }

  const now = new Date();
  if (record.isRevoked || (record.expiresAt && record.expiresAt <= now)) {
    return {
      success: false,
      status: 410,
      error: "SHARE_TOKEN_EXPIRED_OR_REVOKED",
      message: "This shareable trip link has expired or was revoked by the owner",
    };
  }

  return {
    success: true,
    status: 200,
    tripProjection: {
      title: record.title,
      destId: record.destId,
      startDate: record.startDate,
      endDate: record.endDate,
      stops: record.stops,
      expiresAt: record.expiresAt,
    },
  };
}

/**
 * Revoke a shareable trip token.
 *
 * @param {string} shareToken - Target token to revoke.
 * @param {string} userId - Requesting user ID (must match owner).
 * @param {Object} [models] - Database models.
 * @returns {Promise<Object>} Revocation result.
 */
export async function revokeShareableTripRecord(shareToken, userId, models = {}) {
  const { ShareableTripModel, AuditLogModel } = models;
  if (!shareToken || !userId) {
    return { success: false, status: 400, error: "MISSING_PARAMETERS" };
  }

  let updated = null;
  if (ShareableTripModel && typeof ShareableTripModel.findOneAndUpdate === "function") {
    updated = await ShareableTripModel.findOneAndUpdate(
      { shareToken, userId: String(userId) },
      { $set: { isRevoked: true, revokedAt: new Date() } },
      { new: true, returnDocument: "after" }
    );
  }

  if (AuditLogModel && typeof AuditLogModel.create === "function") {
    await AuditLogModel.create({
      actor: String(userId),
      action: "trip.share.token_revoked",
      target: String(shareToken),
      reasonCode: "SHAREABLE_LINK_REVOKED",
      at: new Date(),
    }).catch(() => {});
  }

  return {
    success: true,
    status: 200,
    isRevoked: true,
  };
}
