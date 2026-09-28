import { filterAndRankWaitlists, recordDestinationDecline } from "./matchingEngine.js";

/**
 * Waitlist Service
 *
 * Handles creation, retrieval, cancellation, and notification dispatch
 * for standing tourist waitlist requests.
 */

/**
 * Create a new standing waitlist request for a tourist.
 *
 * @param {Object} params - Entry details.
 * @param {string} params.userId - Tourist user ID.
 * @param {string} [params.businessId] - Specific business ID (or null for destination-wide).
 * @param {string} params.destId - Destination slug (e.g. "shimla").
 * @param {Date|string} params.windowFrom - Start of availability window.
 * @param {Date|string} params.windowTo - End of availability window.
 * @param {number} [params.maxPriceINR=10000] - Maximum price willing to pay in INR.
 * @param {number} [params.travellers=1] - Number of travellers.
 * @param {Object} [models] - Database models (WaitlistModel).
 * @returns {Promise<Object>} Created waitlist object.
 */
export async function createWaitlistEntry(params, models = {}) {
  const { WaitlistModel } = models;
  const {
    userId,
    businessId = null,
    destId,
    windowFrom,
    windowTo,
    maxPriceINR = 10000,
    travellers = 1,
  } = params;

  if (!userId || !destId || !windowFrom || !windowTo) {
    throw new Error("userId, destId, windowFrom, and windowTo are required to create waitlist entry");
  }

  // Idempotent join: a double-click on "Join waitlist" (no submit-disable
  // guard on the frontend button) used to create a fresh row every time,
  // each one counted and rendered separately downstream -- an operator with
  // one real traveller waiting could see that traveller's own duplicate
  // rows several times over. Returning the existing standing request
  // instead keeps "join the waitlist" meaning "have exactly one active
  // request", not "add another".
  if (WaitlistModel && typeof WaitlistModel.findOne === "function") {
    const existing = await WaitlistModel.findOne({ userId, destId, businessId, state: "waiting" });
    if (existing) return existing;
  }

  const newEntry = {
    userId,
    businessId,
    destId,
    window: {
      from: new Date(windowFrom),
      to: new Date(windowTo),
    },
    criteria: {
      maxPriceINR: Number(maxPriceINR),
      travellers: Number(travellers),
    },
    state: "waiting",
    lastNotifiedAt: null,
    notificationsInLast24h: 0,
    notificationHistory: [],
    declinedDestinations: [],
    createdAt: new Date(),
  };

  if (WaitlistModel && typeof WaitlistModel.create === "function") {
    const doc = await WaitlistModel.create(newEntry);
    return doc;
  }

  return {
    _id: "waitlist_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
    ...newEntry,
  };
}

/**
 * Fetch standing waitlists for a given user.
 *
 * @param {string} userId - Tourist user ID.
 * @param {Object} [models] - Database models (WaitlistModel).
 * @returns {Promise<Array<Object>>} List of waitlists.
 */
export async function getUserWaitlists(userId, models = {}) {
  const { WaitlistModel } = models;
  if (!userId) return [];

  if (WaitlistModel && typeof WaitlistModel.find === "function") {
    return WaitlistModel.find({ userId }).sort({ createdAt: -1 });
  }

  return [];
}

/**
 * Cancel a standing waitlist entry.
 *
 * @param {string} waitlistId - Waitlist ID to cancel.
 * @param {string} userId - User ID requesting cancellation.
 * @param {Object} [models] - Database models (WaitlistModel).
 * @returns {Promise<Object>} Updated waitlist object.
 */
export async function cancelWaitlistEntry(waitlistId, userId, models = {}) {
  const { WaitlistModel } = models;
  if (!waitlistId || !userId) {
    throw new Error("waitlistId and userId are required to cancel entry");
  }

  if (WaitlistModel && typeof WaitlistModel.findOneAndUpdate === "function") {
    const updated = await WaitlistModel.findOneAndUpdate(
      { _id: waitlistId, userId, state: "waiting" },
      { $set: { state: "cancelled", cancelledAt: new Date() } },
      { new: true, returnDocument: "after" }
    );
    return updated;
  }

  return { _id: waitlistId, userId, state: "cancelled", cancelledAt: new Date() };
}

/**
 * Process matching for an offer against all active waitlists.
 * Matches, ranks (max 20), updates notification timestamps, and returns recipients.
 *
 * @param {Object} offer - Offer object.
 * @param {Object} [models] - Database models (WaitlistModel, AuditLogModel).
 * @returns {Promise<{ matchCount: number, recipients: Array<Object> }>} Matching summary.
 */
export async function processOfferMatching(offer, models = {}) {
  const { WaitlistModel, AuditLogModel } = models;
  if (!offer) return { matchCount: 0, recipients: [] };

  let activeWaitlists = [];
  if (WaitlistModel && typeof WaitlistModel.find === "function") {
    // Same staleness gap as getBusinessWaitlistController: a "waiting" row
    // whose own requested window has already ended is not actually a real
    // candidate for this offer, and notifying it (or counting it toward
    // the operator's "N people notified" figure) would be dishonest.
    activeWaitlists = await WaitlistModel.find({
      destId: offer.destId,
      state: "waiting",
      "window.to": { $gte: new Date() },
    });
  }

  const recipients = filterAndRankWaitlists(activeWaitlists, offer);

  const now = new Date();
  // Update lastNotifiedAt and notificationHistory for matched recipients
  if (WaitlistModel && recipients.length > 0) {
    const recipientIds = recipients.map((r) => r._id);
    await WaitlistModel.updateMany(
      { _id: { $in: recipientIds } },
      {
        $set: { lastNotifiedAt: now },
        $inc: { notificationsInLast24h: 1 },
        $push: {
          notificationHistory: {
            offerId: offer._id,
            sentAt: now,
          },
        },
      }
    ).catch(() => {});
  }

  if (AuditLogModel && typeof AuditLogModel.create === "function") {
    await AuditLogModel.create({
      actor: "system",
      action: "waitlist.match.executed",
      target: String(offer._id),
      reasonCode: "NOTIFIED_WAITLIST_RECIPIENTS",
      meta: {
        destId: offer.destId,
        recipientCount: recipients.length,
      },
      at: now,
    }).catch(() => {});
  }

  return {
    matchCount: recipients.length,
    recipients,
  };
}

/**
 * A traveller's own offer notifications: every offer they were actually
 * matched/notified about (processOfferMatching already wrote this into each
 * waitlist's notificationHistory when the offer was created -- this just
 * surfaces it, not a new notification system), plus a "fulfilled" entry for
 * any waitlist they've since claimed an offer through. Real events off real
 * documents, nothing synthesized -- if a traveller has never been matched,
 * this returns an empty list rather than fabricating placeholder offers.
 *
 * @param {string} userId - Traveller user ID.
 * @param {Object} [models] - Database models (WaitlistModel, OfferModel).
 * @returns {Promise<Array<Object>>} Notifications, most recent first.
 */
export async function getUserOfferNotifications(userId, models = {}) {
  const { WaitlistModel, OfferModel } = models;
  if (!userId || !WaitlistModel || typeof WaitlistModel.find !== "function") return [];

  const waitlists = await WaitlistModel.find({ userId }).sort({ createdAt: -1 });
  if (waitlists.length === 0) return [];

  const offerIds = [
    ...new Set(
      waitlists.flatMap((w) => (w.notificationHistory || []).map((h) => h.offerId)).filter(Boolean)
    ),
  ];

  let offersById = {};
  if (OfferModel && typeof OfferModel.find === "function" && offerIds.length > 0) {
    const offers = await OfferModel.find({ _id: { $in: offerIds } });
    offersById = Object.fromEntries(offers.map((o) => [String(o._id), o]));
  }

  const notifications = [];
  for (const w of waitlists) {
    for (const h of w.notificationHistory || []) {
      const offer = offersById[String(h.offerId)];
      notifications.push({
        id: `offer:${w._id}:${h.offerId}`,
        type: "offer",
        waitlistId: String(w._id),
        offerId: String(h.offerId),
        destId: w.destId,
        sentAt: h.sentAt,
        response: h.response || null,
        offer: offer
          ? {
              discountPct: offer.discountPct,
              originalPrice: offer.originalPrice,
              effectivePrice: offer.effectivePrice,
              date: offer.date,
              status: offer.status,
            }
          : null,
      });
    }
    if (w.state === "fulfilled" && w.fulfilledAt) {
      notifications.push({
        id: `waitlist:${w._id}:fulfilled`,
        type: "waitlist_fulfilled",
        waitlistId: String(w._id),
        destId: w.destId,
        sentAt: w.fulfilledAt,
        claimedOfferId: w.claimedOfferId,
      });
    }
  }

  notifications.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));
  return notifications;
}

/**
 * Reject a specific offer notification -- the traveller's own explicit
 * "no" to a flash offer their waitlist was matched to. Two effects, both
 * on the SAME waitlist entry (never any other user's): the matching
 * notificationHistory row is stamped "declined" so the Notifications feed
 * stops showing Accept/Reject on it (it's resolved now), and
 * recordDestinationDecline runs the existing-but-previously-unwired 7-day
 * re-notify ban (matchingEngine.js) for this destId, so the traveller
 * isn't immediately re-matched to the very offer they just turned down.
 * Accepting has no equivalent function here -- claiming an offer already
 * goes through POST /v1/offers/:id/claim unchanged, which flips the
 * waitlist to "fulfilled" and that's what the feed keys off of instead.
 *
 * @param {string} waitlistId - The waitlist entry the notification belongs to.
 * @param {string} userId - Must own that waitlist entry.
 * @param {string} offerId - The specific offer being declined.
 * @param {Object} [models] - Database models (WaitlistModel).
 * @returns {Promise<Object|null>} The updated waitlist doc, or null if not found/not owned.
 */
export async function declineOfferNotification(waitlistId, userId, offerId, models = {}) {
  const { WaitlistModel } = models;
  if (!waitlistId || !userId || !offerId) {
    throw new Error("waitlistId, userId, and offerId are required to decline an offer notification");
  }
  if (!WaitlistModel || typeof WaitlistModel.findOne !== "function") return null;

  const waitlist = await WaitlistModel.findOne({ _id: waitlistId, userId });
  if (!waitlist) return null;

  const entry = (waitlist.notificationHistory || []).find((h) => String(h.offerId) === String(offerId));
  if (entry) entry.response = "declined";

  recordDestinationDecline(waitlist, waitlist.destId);
  await waitlist.save();
  return waitlist;
}
