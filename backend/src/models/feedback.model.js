import mongoose from "mongoose";
import { VALID_CATEGORIES } from "../services/feedback/feedbackService.js";

// feedback — AI Tourist Feedback Intelligence (spec §3.2). One row per
// traveller review; feedbackService.js's processBusinessFeedback() reads
// these in batch (>= MIN_FEEDBACK_THRESHOLD) to extract themes/actions,
// which then get cached onto the Business document (aiThemes/aiActions/
// feedbackSummary -- see business.model.js). Gated at submission time
// (feedback.controller.js) to travellers with a real verified visit to
// this exact business -- same Visit collection Proof-of-Visit already
// uses, not a second attestation mechanism.
const feedbackSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    businessId: { type: String, required: true },
    destId: { type: String, required: true },
    category: { type: String, enum: VALID_CATEGORIES, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, trim: true, maxlength: 1000 },
  },
  { timestamps: true }
);

feedbackSchema.index({ businessId: 1, createdAt: -1 }); // processBusinessFeedback's per-business batch read
feedbackSchema.index({ userId: 1, businessId: 1 });

const Feedback = mongoose.model("Feedback", feedbackSchema, "feedback");
export default Feedback;
