import mongoose from "mongoose";

// community_submissions — queue only (spec §3.1). Never write directly to a
// destinations collection; the admin review step (POST /:id/review) is the sole
// path that promotes a row, and only on explicit "approve".
const communitySubmissionSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    name: { type: String, required: true },
    // Which state the submitter says this place is in -- required, free
    // text (not restricted to a fixed list -- this platform's seeded
    // destination coverage is not the boundary of where a traveller can
    // suggest a place). Powers the Community Forum's state filter; nothing
    // derives it automatically (no geocoding call), it's exactly what the
    // traveller typed.
    state: { type: String, required: true, trim: true, maxlength: 100 },
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
    // Community Forum like/dislike -- userIds only (never exposed directly;
    // the API only ever returns counts + the viewer's own reaction), one
    // vote per user, mutually exclusive (liking removes an existing
    // dislike and vice versa). Plain string arrays, same pattern as
    // Waitlist's declinedDestinations elsewhere in this codebase.
    likedBy: { type: [String], default: [] },
    dislikedBy: { type: [String], default: [] },
    // Community Forum "views" -- userIds only, same anonymized-count
    // pattern as likedBy/dislikedBy: one entry per unique viewer (added the
    // first time their feed fetch includes this post), so the count means
    // "N travellers have seen this", not "N page loads".
    viewedBy: { type: [String], default: [] },
    // Community Forum comments -- short free-text replies, anonymized the
    // same way the post itself is (userId never leaves the API response,
    // only used server-side to mark a viewer's own comment as `isMine`).
    comments: {
      type: [
        {
          userId: { type: String, required: true },
          text: { type: String, required: true, trim: true, maxlength: 500 },
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
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
