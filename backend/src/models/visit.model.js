import mongoose from "mongoose";

// Visits — Proof-of-Visit records (Trust Vertical spec §1). Anti-replay (§1.2
// step 3) needs a DB-enforced constraint, not just an app-level query: unique on
// (userId, businessId, codeStep) scoped to verified visits only, so a rejected
// attempt can be retried but a verified one can never be replayed for the same step.
const visitSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    businessId: { type: String, required: true },
    destId: { type: String, required: true }, // Ananya's canonical slug, never a Place ID
    originalDestId: { type: String },
    method: { type: String, default: "rotating-code" },
    codeStep: { type: Number, required: true },
    status: { type: String, enum: ["verified"], default: "verified" },
    verifiedAt: { type: Date, default: Date.now },
    location: {
      lat: Number,
      lng: Number,
    },
  },
  { timestamps: true }
);

visitSchema.index(
  { userId: 1, businessId: 1, codeStep: 1 },
  { unique: true, partialFilterExpression: { status: "verified" } }
);
visitSchema.index({ userId: 1, verifiedAt: -1 }); // velocity check's "last verified visit" lookup

const Visit = mongoose.model("Visit", visitSchema, "visits");
export default Visit;
