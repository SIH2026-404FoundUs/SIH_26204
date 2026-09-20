import mongoose from "mongoose";

// Worker role design spec §02/§03 -- the link between one worker and one
// request, kept as its own document (not a subarray on either side) so a
// single GigRequest with headcount > 1 can hold several of these at once,
// one per matched worker, each moving through the lifecycle independently.
export const GIG_MATCH_STATUSES = ["offered", "accepted", "declined", "completed", "no_show", "cancelled"];

const ratingSubschema = {
  score: { type: Number, min: 1, max: 5 },
  comment: { type: String, maxlength: 500 },
  ratedAt: { type: Date },
};

const gigMatchSchema = new mongoose.Schema(
  {
    gigRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GigRequest",
      required: true,
      index: true,
    },
    workerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WorkerProfile",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: GIG_MATCH_STATUSES,
      default: "offered",
    },
    respondedAt: { type: Date },
    completedAt: { type: Date },
    // Both directions -- a worker rating the operator matters as much as
    // the reverse (spec §07).
    ratingByOperator: ratingSubschema,
    ratingByWorker: ratingSubschema,
  },
  { timestamps: true }
);

// One offer per (gig, worker) pair -- accepting/declining/re-offering the
// same pairing always updates this one row, never duplicates it.
gigMatchSchema.index({ gigRequestId: 1, workerId: 1 }, { unique: true });

const GigMatch = mongoose.model("GigMatch", gigMatchSchema);
export default GigMatch;
