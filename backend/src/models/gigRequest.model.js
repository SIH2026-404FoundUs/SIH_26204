import mongoose from "mongoose";
import { WORKER_SKILLS } from "./workerProfile.model.js";

// Worker role design spec §02 -- what an operator needs, and by when. A gig
// is dated, never open-ended (startDate/endDate both required), and can
// exist without an attached listed Business (businessId optional) -- an
// operator posting "need a driver Thursday" doesn't need a registered
// listing to do it, just an account.
export const GIG_REQUEST_STATUSES = ["open", "matched", "filled", "cancelled", "expired"];

const gigRequestSchema = new mongoose.Schema(
  {
    operatorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    businessId: {
      type: String,
      ref: "Business",
    },
    destId: {
      type: String,
      required: true,
      index: true,
    },
    skillNeeded: {
      type: String,
      enum: WORKER_SKILLS,
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    headcount: {
      type: Number,
      default: 1,
      min: 1,
    },
    budget: {
      min: { type: Number },
      max: { type: Number },
    },
    notes: {
      type: String,
      maxlength: 500,
    },
    status: {
      type: String,
      enum: GIG_REQUEST_STATUSES,
      default: "open",
    },
  },
  { timestamps: true }
);

gigRequestSchema.index({ destId: 1, skillNeeded: 1, status: 1 });
gigRequestSchema.index({ operatorUserId: 1, createdAt: -1 });

const GigRequest = mongoose.model("GigRequest", gigRequestSchema);
export default GigRequest;
