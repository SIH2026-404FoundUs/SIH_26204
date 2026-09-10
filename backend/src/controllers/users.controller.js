import mongoose from "mongoose";
import User from "../models/user.model.js";

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

// PATCH /api/v1/users/:id/preferences — self-only edit of the same
// `preferences` subdocument the GET above reads (spec: "reuse the existing
// preference structure... do not reintroduce removed/unsupported fields").
// Only the three fields the schema already defines are ever written --
// interests/budgetBand/languages -- via an explicit allow-list, same
// mass-assignment-safe pattern used everywhere else in this codebase.
export const updateUserPreferencesController = async (req, res) => {
  try {
    if (String(req.user._id) !== String(req.params.id)) {
      return res.status(403).json({ message: "You can only edit your own preferences" });
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "invalid user id" });
    }

    const { interests, budgetBand, languages } = req.body;
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
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: "at least one of interests, budgetBand, languages is required" });
    }

    const user = await User.findByIdAndUpdate(req.params.id, { $set: update }, { new: true }).select("preferences");
    if (!user) return res.status(404).json({ message: "user not found" });
    res.status(200).json(user.preferences);
  } catch (error) {
    console.log("Error in updateUserPreferences controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
