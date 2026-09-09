import mongoose from "mongoose";

// community_submissions — queue only (spec §3.1). Never write directly to a
// destinations collection; the admin review step (POST /:id/review) is the sole
// path that promotes a row, and only on explicit "approve".
const communitySubmissionSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    name: { type: String, required: true },
    // Which state the submitter says this place is in -- required, chosen
    // from the same two states the platform actually has seeded
    // destinations/pressure data for (frontend's DESTINATION_GROUPS), not a
    // full India state list this platform doesn't cover yet. Powers the
    // Community Forum's state filter; nothing derives it automatically
    // (no geocoding call), it's exactly what the traveller picked.
    state: { type: String, enum: ["Himachal Pradesh", "Telangana"], required: true },
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    description: { type: String, default: "" },
    photos: { type: [String], default: [] },
    aiEnrichment: { type: mongoose.Schema.Types.Mixed },
    // "flagged" is a distinct terminal state from a routine "rejected" --
    // harmful/unethical content, not just a submission that didn't meet
    // criteria (spec: authority must be able to "flag harmful content" as
    // its own visible outcome, not folded into a generic rejection).
    status: { type: String, enum: ["queued", "approved", "rejected", "flagged"], default: "queued" },
    approvedByAdminId: String,
    approvedAt: Date,
    rejectedByAdminId: String,
    rejectedAt: Date,
    rejectionReason: String,
  },
  { timestamps: true }
);

communitySubmissionSchema.index({ userId: 1, createdAt: -1 }); // 30-day rate-limit lookup (spec §3.1)
communitySubmissionSchema.index({ status: 1 });

const CommunitySubmission = mongoose.model(
  "CommunitySubmission",
  communitySubmissionSchema,
  "community_submissions"
);
export default CommunitySubmission;
