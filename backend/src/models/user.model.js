import mongoose from "mongoose";
import { TRAVEL_TYPE_IDS, PREFERRED_ACTIVITIES, PREFERRED_PACE, PREFERRED_GROUP_SIZE, PREFERRED_TRIP_DURATION } from "../lib/travelTypes.js";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
    },
    fullName: {
      type: String,
      required: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      // "worker" added for the Worker role (gig-matching layer for drivers/
      // guides/cooks/cleaners, split out of the Operator/Business shape --
      // see worker-role-spec.md/models/workerProfile.model.js). Every other
      // role's behavior is unchanged by this addition.
      enum: ["traveller", "operator", "authority", "worker"],
      default: "traveller",
    },
    phone: {
      type: String,
    },
    // Cloudinary secure URL -- same upload mechanism as community-submission
    // photos (backend/src/lib/cloudinary.js), different folder. null means
    // "no photo set", not "loading" -- the frontend falls back to a generic
    // avatar icon in that case.
    profilePhoto: {
      type: String,
      default: null,
    },
    preferredLanguage: {
      type: String,
    },
    // Bumped on password reset and password change so any JWT issued before
    // that moment stops working -- a plain JWT has no server-side revocation
    // otherwise. protectRoute checks this against the token's own embedded
    // value (auth spec §12/§16: "invalidate existing sessions... where the
    // architecture supports it").
    tokenVersion: {
      type: Number,
      default: 0,
    },
    preferences: {
      interests: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
      budgetBand: {
        type: String,
      },
      languages: {
        type: [String],
        default: [],
      },
      // Travel Types (Revised Implementation Plan §6) -- structured
      // additions to this SAME preferences subdocument, not a second
      // TravellerProfile collection. interests/budgetBand/languages above
      // are untouched; existing readers (planner tool, PreferencesCard)
      // keep working unchanged, they just don't see these fields yet.
      travelTypes: {
        type: [String],
        enum: TRAVEL_TYPE_IDS,
        default: [],
      },
      primaryTravelType: {
        type: String,
        enum: TRAVEL_TYPE_IDS,
      },
      preferredActivities: {
        type: [String],
        enum: PREFERRED_ACTIVITIES,
        default: [],
      },
      preferredPace: {
        type: String,
        enum: PREFERRED_PACE,
      },
      // Structured INR range, additive alongside budgetBand rather than
      // replacing it (plan §6: "retaining compatibility with existing
      // budgetBand").
      budgetRange: {
        min: { type: Number },
        max: { type: Number },
      },
      preferredGroupSize: {
        type: String,
        enum: PREFERRED_GROUP_SIZE,
      },
      preferredTripDuration: {
        type: String,
        enum: PREFERRED_TRIP_DURATION,
      },
      openToGroupTravel: {
        type: Boolean,
        default: false,
      },
      openToCaptainLedTrips: {
        type: Boolean,
        default: false,
      },
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export default User;
