import mongoose from "mongoose";
import { TRAVEL_TYPE_IDS, PREFERRED_ACTIVITIES, PREFERRED_PACE, PREFERRED_GROUP_SIZE } from "../lib/travelTypes.js";

// Group Travel (Revised Implementation Plan §10/§11) -- a PARALLEL object
// to the existing Trip model, deliberately not an extension of it. Trip
// stays the individual planning/execution/redistribution-tracking model,
// untouched; GroupTrip is social group formation around a destination/
// date, reusing destId/pressure/alternatives/notifications/Trust-Safety/
// Worker-Gig infrastructure rather than rebuilding any of it.
export const JOIN_POLICIES = ["open", "request"];
export const GROUP_TRIP_STATUSES = ["draft", "open", "forming", "confirmed", "active", "completed", "cancelled"];

const groupTripSchema = new mongoose.Schema(
  {
    creatorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // Same canonical destId every other feature uses (§3) -- validated
    // against the real seed at the service layer, never a second
    // destination namespace.
    destId: { type: String, required: true, index: true },

    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },

    travelTypes: { type: [String], enum: TRAVEL_TYPE_IDS, default: [] },
    activities: { type: [String], enum: PREFERRED_ACTIVITIES, default: [] },
    pace: { type: String, enum: PREFERRED_PACE },
    budgetRange: {
      min: { type: Number },
      max: { type: Number },
    },
    preferredGroupSize: { type: String, enum: PREFERRED_GROUP_SIZE },

    maxMembers: { type: Number, required: true, min: 2 },
    // Starts at 1 -- the creator counts as the first accepted member
    // (see groupTripService.createGroupTrip). Every increment/decrement
    // from here on is atomic (findOneAndUpdate with an $expr guard), never
    // a read-then-write in application code (§19's own explicit rule).
    currentMembers: { type: Number, default: 1 },

    joinPolicy: { type: String, enum: JOIN_POLICIES, default: "request" },
    status: { type: String, enum: GROUP_TRIP_STATUSES, default: "open" },

    captainId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    // Set when the creator requests a captain (captainService.requestCaptainForGroup)
    // -- lets the worker/gig accept flow find its way back to this group
    // without GigRequest itself needing to know about GroupTrip (§13: "no
    // second worker marketplace", so the bridge is one-directional and thin).
    captainGigRequestId: { type: mongoose.Schema.Types.ObjectId, ref: "GigRequest", default: null },
    // Free-form day-by-day notes the creator/captain can edit -- not the
    // Trip Planner's own TripSummary contract (that stays the individual
    // planning flow's own object); this is a lightweight shared plan for
    // the squad, per §13.
    itinerary: { type: [{ day: Number, notes: String, _id: false }], default: [] },
    announcements: { type: [{ text: String, postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, postedAt: { type: Date, default: Date.now }, _id: false }], default: [] },

    // Captured on creation, refreshed later -- read-only from the Pressure
    // Engine (§4), never recomputed or persisted back into it. A material
    // change surfaces alternatives to members; it never silently moves the
    // group's destId (§5's own explicit rule).
    pressureSnapshot: {
      score: { type: Number, default: null },
      capturedAt: { type: Date },
      confidence: { type: String, enum: ["normal", "low", "stale"], default: "normal" },
    },
  },
  { timestamps: true }
);

groupTripSchema.index({ destId: 1, startDate: 1, status: 1 });

const GroupTrip = mongoose.model("GroupTrip", groupTripSchema);
export default GroupTrip;
