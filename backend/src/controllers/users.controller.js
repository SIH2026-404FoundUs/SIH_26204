import mongoose from "mongoose";
import User from "../models/user.model.js";
import { TRAVEL_TYPE_IDS, PREFERRED_ACTIVITIES, PREFERRED_PACE, PREFERRED_GROUP_SIZE, PREFERRED_TRIP_DURATION } from "../lib/travelTypes.js";

// GET /api/v1/users/:id/preferences — public read, no auth, consistent with
// every other agent-facing tool endpoint in this codebase (pressure, alerts,
// businesses). Exposes only the `preferences` subdocument, never passwordHash.
export const getUserPreferencesController = async (req, res) => {
  try {
    if (!req.isInternalService && String(req.user._id) !== String(req.params.id)) {
      return res.status(403).json({ message: "You can only read your own preferences" });
    }
    // A malformed id (not a 24-char hex ObjectId) makes findById throw a
    // CastError -- that's caller error, not a server fault, so surface it as
    // 400 rather than letting the catch-all below turn it into a 500.
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "invalid user id" });
    }
    const user = await User.findById(req.params.id).select("preferences");
    if (!user) return res.status(404).json({ message: "user not found" });
    res.status(200).json(user.preferences);
  } catch (error) {
    console.log("Error in getUserPreferences controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

function isStringArrayFrom(value, allowed) {
  return Array.isArray(value) && value.every((v) => typeof v === "string" && allowed.includes(v));
}

// PATCH /api/v1/users/:id/preferences — self-only edit of the same
// `preferences` subdocument the GET above reads (spec: "reuse the existing
// preference structure... do not reintroduce removed/unsupported fields").
// Every field ever written is named explicitly here -- interests/
// budgetBand/languages (original three) plus the Travel Types structured
// additions (plan §6) -- same mass-assignment-safe allow-list pattern used
// everywhere else in this codebase, now just a longer list.
export const updateUserPreferencesController = async (req, res) => {
  try {
    if (String(req.user._id) !== String(req.params.id)) {
      return res.status(403).json({ message: "You can only edit your own preferences" });
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "invalid user id" });
    }

    const {
      interests, budgetBand, languages,
      travelTypes, primaryTravelType, preferredActivities, preferredPace,
      budgetRange, preferredGroupSize, preferredTripDuration,
      openToGroupTravel, openToCaptainLedTrips,
    } = req.body;
    const update = {};

    if (interests !== undefined) {
      if (typeof interests !== "object" || interests === null || Array.isArray(interests)) {
        return res.status(400).json({ message: "interests must be an object" });
      }
      update["preferences.interests"] = interests;
    }
    if (budgetBand !== undefined) {
      if (typeof budgetBand !== "string") {
        return res.status(400).json({ message: "budgetBand must be a string" });
      }
      update["preferences.budgetBand"] = budgetBand;
    }
    if (languages !== undefined) {
      if (!Array.isArray(languages) || languages.some((l) => typeof l !== "string")) {
        return res.status(400).json({ message: "languages must be an array of strings" });
      }
      update["preferences.languages"] = languages;
    }
    if (travelTypes !== undefined) {
      if (!isStringArrayFrom(travelTypes, TRAVEL_TYPE_IDS)) {
        return res.status(400).json({ message: `travelTypes must be an array from: ${TRAVEL_TYPE_IDS.join(", ")}` });
      }
      update["preferences.travelTypes"] = travelTypes;
    }
    if (primaryTravelType !== undefined) {
      if (primaryTravelType !== null && !TRAVEL_TYPE_IDS.includes(primaryTravelType)) {
        return res.status(400).json({ message: `primaryTravelType must be one of: ${TRAVEL_TYPE_IDS.join(", ")}` });
      }
      update["preferences.primaryTravelType"] = primaryTravelType;
    }
    if (preferredActivities !== undefined) {
      if (!isStringArrayFrom(preferredActivities, PREFERRED_ACTIVITIES)) {
        return res.status(400).json({ message: `preferredActivities must be an array from: ${PREFERRED_ACTIVITIES.join(", ")}` });
      }
      update["preferences.preferredActivities"] = preferredActivities;
    }
    if (preferredPace !== undefined) {
      if (preferredPace !== null && !PREFERRED_PACE.includes(preferredPace)) {
        return res.status(400).json({ message: `preferredPace must be one of: ${PREFERRED_PACE.join(", ")}` });
      }
      update["preferences.preferredPace"] = preferredPace;
    }
    if (budgetRange !== undefined) {
      const min = budgetRange?.min;
      const max = budgetRange?.max;
      if (typeof budgetRange !== "object" || budgetRange === null || (min != null && typeof min !== "number") || (max != null && typeof max !== "number")) {
        return res.status(400).json({ message: "budgetRange must be an object with numeric min/max" });
      }
      if (min != null && max != null && min > max) {
        return res.status(400).json({ message: "budgetRange.min must be <= budgetRange.max" });
      }
      update["preferences.budgetRange"] = { min, max };
    }
    if (preferredGroupSize !== undefined) {
      if (preferredGroupSize !== null && !PREFERRED_GROUP_SIZE.includes(preferredGroupSize)) {
        return res.status(400).json({ message: `preferredGroupSize must be one of: ${PREFERRED_GROUP_SIZE.join(", ")}` });
      }
      update["preferences.preferredGroupSize"] = preferredGroupSize;
    }
    if (preferredTripDuration !== undefined) {
      if (preferredTripDuration !== null && !PREFERRED_TRIP_DURATION.includes(preferredTripDuration)) {
        return res.status(400).json({ message: `preferredTripDuration must be one of: ${PREFERRED_TRIP_DURATION.join(", ")}` });
      }
      update["preferences.preferredTripDuration"] = preferredTripDuration;
    }
    if (openToGroupTravel !== undefined) {
      if (typeof openToGroupTravel !== "boolean") {
        return res.status(400).json({ message: "openToGroupTravel must be a boolean" });
      }
      update["preferences.openToGroupTravel"] = openToGroupTravel;
    }
    if (openToCaptainLedTrips !== undefined) {
      if (typeof openToCaptainLedTrips !== "boolean") {
        return res.status(400).json({ message: "openToCaptainLedTrips must be a boolean" });
      }
      update["preferences.openToCaptainLedTrips"] = openToCaptainLedTrips;
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: "at least one preference field is required" });
    }

    const user = await User.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true }).select("preferences");
    if (!user) return res.status(404).json({ message: "user not found" });
    res.status(200).json(user.preferences);
  } catch (error) {
    console.log("Error in updateUserPreferences controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
