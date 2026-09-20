import mongoose from "mongoose";

// complaints — logged for platform moderation only (spec §5.4). Never claim
// forwarding to a government body since no such integration exists.
const complaintSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    destId: { type: String, required: true }, // Ananya's canonical slug
    businessId: { type: String, default: null },
    category: {
      type: String,
      enum: [
        // Traveller-facing categories (original set)
        "safety_advisory",
        "overcharging_pricing",
        "hygiene_cleanliness",
        "service_misrepresentation",
        "transport_issue",
        // Operator-facing categories -- an operator reporting something is
        // never complaining about being overcharged or mis-served the way
        // a traveller would; these are the real shapes an operator's
        // report actually takes. Same Complaint collection, same
        // moderation queue -- just a category vocabulary that matches who
        // is actually filing it.
        "traveller_dispute",
        "unfair_review",
        "payment_billing_issue",
        "platform_policy_issue",
        // Worker-facing categories -- a worker reporting something is about
        // the gig relationship (an operator, a job), never overcharging or
        // hygiene at a listing. Same collection/queue as every other role.
        "gig_dispute",
        "nonpayment",
        "unsafe_work_conditions",
        "unfair_rating",
        "other",
      ],
      default: "other",
    },
    text: { type: String, required: true },
    photos: { type: [String], default: [] },
    status: { type: String, enum: ["logged", "under_review", "resolved"], default: "logged" },
  },
  { timestamps: true }
);

complaintSchema.index({ userId: 1, createdAt: -1 });
complaintSchema.index({ destId: 1 });

const Complaint = mongoose.model("Complaint", complaintSchema, "complaints");
export default Complaint;
