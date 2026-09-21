import mongoose from "mongoose";

// Membership row -- §10/§11: "Membership and role/status" is its own
// object, not a field flattened onto GroupTrip, so join/accept/reject/
// leave each have a real row with its own timestamps and match-factor
// results (§12: "store factor-level outcomes so the matching logic can
// later be evaluated against real usage").
export const MEMBER_ROLES = ["creator", "member"];
export const MEMBER_STATUSES = ["requested", "accepted", "rejected", "left"];

const groupTripMemberSchema = new mongoose.Schema(
  {
    groupTripId: { type: mongoose.Schema.Types.ObjectId, ref: "GroupTrip", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    role: { type: String, enum: MEMBER_ROLES, default: "member" },
    status: { type: String, enum: MEMBER_STATUSES, default: "requested" },
    // Factor-by-factor match outcome at the moment of the join request
    // (§12) -- booleans + the reasons shown to the user, never a numeric
    // score persisted or displayed.
    matchFactors: { type: mongoose.Schema.Types.Mixed, default: {} },
    matchReasons: { type: [String], default: [] },
    joinedAt: { type: Date },
  },
  { timestamps: true }
);

// One row per (group, user) -- re-requesting after "left"/"rejected" reuses
// the same row (service layer upserts) rather than accumulating duplicate
// history, which also makes "no duplicate active membership" a natural
// consequence of this index rather than a separate check that could drift.
groupTripMemberSchema.index({ groupTripId: 1, userId: 1 }, { unique: true });

const GroupTripMember = mongoose.model("GroupTripMember", groupTripMemberSchema);
export default GroupTripMember;
