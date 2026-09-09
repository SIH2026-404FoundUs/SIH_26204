import mongoose from "mongoose";

// WAITLISTS — standing requests only (spec §2). The claim guard itself lives on
// OFFERS, not here — that separation is the whole point of the fix: up to 20
// waitlist rows can be notified about one opening, but only one shared OFFERS
// document exists for them to race over.
const waitlistSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    businessId: { type: String, default: null },
    destId: { type: String, required: true }, // "same destId" is the whole definition of "nearby" (spec §2.1)
    window: {
      from: { type: Date, required: true },
      to: { type: Date, required: true },
    },
    criteria: {
      maxPriceINR: { type: Number, default: 10000 },
      travellers: { type: Number, default: 1 },
    },
    state: { type: String, enum: ["waiting", "fulfilled", "cancelled"], default: "waiting" },
    lastNotifiedAt: { type: Date, default: null },
    notificationsInLast24h: { type: Number, default: 0 }, // spec §2.2 cap: 3/24h
    // response stays unset while a notified offer is still awaiting the
    // traveller's accept/reject; "declined" is the only value actually
    // written (see waitlistService.declineOfferNotification) -- "accepted"
    // isn't needed to know an accept happened, since a successful claim
    // already flips state to "fulfilled" below and that's what the
    // Notifications feed keys off of instead.
    notificationHistory: [{ offerId: String, sentAt: Date, response: { type: String, enum: ["accepted", "declined"] } }],
    // 7-day re-notify ban (spec §2.2). Pre-existing bug fixed here: this was
    // typed [String] while matchingEngine.js's recordDestinationDecline()
    // (and its own read-side check, hasRecentDeclineForDestination()) both
    // always pushed/read {destId, declinedAt} objects -- silently never hit
    // before now because recordDestinationDecline was dead code (nothing
    // called it) until declineOfferNotification wired it up.
    declinedDestinations: { type: [{ destId: String, declinedAt: Date }], default: [] },
    fulfilledAt: Date,
    claimedOfferId: String,
    cancelledAt: Date,
  },
  { timestamps: true }
);

waitlistSchema.index({ destId: 1, state: 1 });
waitlistSchema.index({ userId: 1 });

const Waitlist = mongoose.model("Waitlist", waitlistSchema, "waitlists");
export default Waitlist;
