/**
 * SmartWaitlist & Offers Service Module
 *
 * Implements shared OFFERS collection logic, atomic claims (findOneAndUpdate),
 * "nearby" destId matching, budget headroom ranking, 24h notification cap, and 7-day decline ban.
 */

export {
  createOffer,
  claimOfferAtomic,
  expireOffersJob,
} from "./offerService.js";

export {
  filterAndRankWaitlists,
  recordDestinationDecline,
  MAX_RECIPIENTS_CAP,
  MAX_NOTIFICATIONS_PER_24H,
  DECLINE_BAN_DAYS,
} from "./matchingEngine.js";

export {
  createWaitlistEntry,
  getUserWaitlists,
  cancelWaitlistEntry,
  processOfferMatching,
} from "./waitlistService.js";
