import mongoose from "mongoose";
import User from "../models/user.model.js";

// GET /api/v1/users/:id/preferences — public read, no auth, consistent with
// every other agent-facing tool endpoint in this codebase (pressure, alerts,
// businesses). Exposes only the `preferences` subdocument, never passwordHash.
export const getUserPreferencesController = async (req, res) => {
  try {
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
