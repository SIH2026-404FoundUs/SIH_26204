import mongoose from "mongoose";

// OFFERS — SmartWaitlist flash openings (spec §2). This is the shared document
// everyone competes for; the atomic findOneAndUpdate claim in offerService.js is
// what actually fixes the original bug (20 separate WAITLISTS rows, each able to
// "win" independently). The TTL index lets Mongo reap expired rows on its own;
// the 1-minute sweep job (jobs/expireOffers.job.js) flips status first so a
// listing shows "expired" honestly in the gap before Mongo deletes the document.
const offerSchema = new mongoose.Schema(
  {
    businessId: { type: String, required: true },
    destId: { type: String, required: true }, // Ananya's canonical slug
    date: { type: Date, required: true },
    originalPrice: { type: Number, default: 0 },
    discountPct: { type: Number, default: 0 },
    effectivePrice: { type: Number },
    status: { type: String, enum: ["open", "claimed", "expired"], default: "open" },
    claimedBy: { type: String, default: null },
    claimedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

offerSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
offerSchema.index({ destId: 1, status: 1 });

const Offer = mongoose.model("Offer", offerSchema, "offers");
export default Offer;
