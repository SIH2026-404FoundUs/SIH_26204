/**
 * SmartWaitlist Matching Engine
 *
 * Matches new Flash Offers against waiting tourists.
 *
 * Rules:
 * - "Nearby" = Same destId (canonical destination slug, e.g. "shimla").
 * - Match criteria: destId match, date window overlap, maxPriceINR >= effectivePrice.
 * - Ranking: budget headroom x recency, capped at 20 recipients.
 * - Rate limits: Max 3 flash notifications per 24h. Exclude users who declined same destId in last 7 days.
 */

// Rate limit constants per specification
export const MAX_RECIPIENTS_CAP = 20;
export const MAX_NOTIFICATIONS_PER_24H = 3;
export const DECLINE_BAN_DAYS = 7;

/**
 * Filter and rank waitlist entries eligible to receive a flash offer notification.
 *
 * @param {Array<Object>} waitlists - List of candidate waitlist documents.
 * @param {Object} offer - The flash offer document.
 * @param {Date} [now=new Date()] - Reference timestamp.
 * @returns {Array<Object>} Ranked array of up to 20 matched waitlist documents.
 */
export function filterAndRankWaitlists(waitlists, offer, now = new Date()) {
  if (!Array.isArray(waitlists) || !offer) {
    return [];
  }

  const offerDestId = offer.destId;
  const effectivePrice = offer.effectivePrice ?? 0;
  const offerDateMs = new Date(offer.date).getTime();

  const twentyFourHoursAgoMs = now.getTime() - 24 * 60 * 60 * 1000;
  const sevenDaysAgoMs = now.getTime() - DECLINE_BAN_DAYS * 24 * 60 * 60 * 1000;

  // Filter eligible waitlists
  const eligible = waitlists.filter((w) => {
    // 1. "Nearby" definition: Same destId
    if (w.destId !== offerDestId) return false;

    // 2. Must be in "waiting" state
    if (w.state !== "waiting") return false;

    // 3. Time window overlap (window.from <= offer.date <= window.to)
    if (w.window && w.window.from && w.window.to) {
      const windowFromMs = new Date(w.window.from).getTime();
      const windowToMs = new Date(w.window.to).getTime();
      if (offerDateMs < windowFromMs || offerDateMs > windowToMs) return false;
    }

    // 4. Budget headroom check (criteria.maxPriceINR >= effectivePrice)
    const maxPrice = w.criteria?.maxPriceINR ?? Infinity;
    if (maxPrice < effectivePrice) return false;

    // 5. Rate limit: Max 3 notifications per 24h
    const notifCount24h = getNotificationsInLast24h(w, twentyFourHoursAgoMs);
    if (notifCount24h >= MAX_NOTIFICATIONS_PER_24H) return false;

    // 6. Rate limit: Exclude users who declined same destId in last 7 days
    if (hasRecentDeclineForDestination(w, offerDestId, sevenDaysAgoMs)) {
      return false;
    }

    return true;
  });

  // Rank eligible candidates: budgetHeadroom x recency
  const scored = eligible.map((w) => {
    const maxPrice = w.criteria?.maxPriceINR ?? effectivePrice;
    const headroom = Math.max(1, maxPrice - effectivePrice);

    const createdAtMs = w.createdAt ? new Date(w.createdAt).getTime() : now.getTime();
    const ageMinutes = Math.max(0, (now.getTime() - createdAtMs) / (60 * 1000));
    // Earlier created waitlist gets higher recency score
    const recencyScore = 1000 / (ageMinutes + 1);

    const rankScore = headroom * recencyScore;

    return { waitlist: w, rankScore };
  });

  // Sort descending by rankScore
  scored.sort((a, b) => b.rankScore - a.rankScore);

  // Cap at 20 recipients
  const recipients = scored.slice(0, MAX_RECIPIENTS_CAP).map((s) => s.waitlist);

  return recipients;
}

/**
 * Calculate notification count for a waitlist user within the last 24h.
 */
function getNotificationsInLast24h(waitlist, twentyFourHoursAgoMs) {
  if (Array.isArray(waitlist.notificationHistory)) {
    return waitlist.notificationHistory.filter(
      (n) => new Date(n.sentAt).getTime() >= twentyFourHoursAgoMs
    ).length;
  }

  // Fallback to lastNotifiedAt timestamp check
  if (waitlist.lastNotifiedAt) {
    const lastNotifiedMs = new Date(waitlist.lastNotifiedAt).getTime();
    if (lastNotifiedMs >= twentyFourHoursAgoMs) {
      return waitlist.notificationCount24h || 1;
    }
  }

  return 0;
}

/**
 * Check if the waitlist user recently declined an offer for the destination within 7 days.
 */
function hasRecentDeclineForDestination(waitlist, destId, sevenDaysAgoMs) {
  if (!Array.isArray(waitlist.declinedDestinations)) {
    return false;
  }

  return waitlist.declinedDestinations.some(
    (d) => d.destId === destId && new Date(d.declinedAt).getTime() >= sevenDaysAgoMs
  );
}

/**
 * Record a destination decline for a user (triggers 7-day notification ban for that destId).
 *
 * @param {Object} waitlist - Waitlist document.
 * @param {string} destId - Destination slug declined.
 * @param {Date} [now=new Date()] - Timestamp of decline.
 */
export function recordDestinationDecline(waitlist, destId, now = new Date()) {
  if (!waitlist.declinedDestinations) {
    waitlist.declinedDestinations = [];
  }

  waitlist.declinedDestinations.push({
    destId,
    declinedAt: now,
  });

  return waitlist;
}
