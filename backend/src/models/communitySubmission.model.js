import mongoose from "mongoose";

// community_submissions — queue only (spec §3.1). Never write directly to a
// destinations collection; the admin review step (POST /:id/review) is the sole
// path that promotes a row, and only on explicit "approve".
const communitySubmissionSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    name: { type: String, required: true },
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    description: { type: String, default: "" },
    photos: { type: [String], default: [] },
    aiEnrichment: { type: mongoose.Schema.Types.Mixed },
    status: { type: String, enum: ["queued", "approved", "rejected"], default: "queued" },
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
