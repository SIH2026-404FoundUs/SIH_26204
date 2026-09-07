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
    notificationHistory: [{ offerId: String, sentAt: Date }],
    declinedDestinations: { type: [String], default: [] }, // 7-day re-notify ban (spec §2.2)
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
