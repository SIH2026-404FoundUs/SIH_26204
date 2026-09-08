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
        "safety_advisory",
        "overcharging_pricing",
        "hygiene_cleanliness",
        "service_misrepresentation",
        "transport_issue",
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
