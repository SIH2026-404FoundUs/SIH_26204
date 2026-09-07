import {
  createWaitlistEntry,
  getUserWaitlists,
  cancelWaitlistEntry,
} from "../services/waitlist/waitlistService.js";
import Waitlist from "../models/waitlist.model.js";

const models = { WaitlistModel: Waitlist };

// POST /api/v1/waitlist — standing request against a destination/business (spec §2)
export const createWaitlistController = async (req, res) => {
  try {
    const entry = await createWaitlistEntry({ ...req.body, userId: String(req.user._id) }, models);
    res.status(201).json(entry);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// GET /api/v1/waitlist/mine
export const getMyWaitlistsController = async (req, res) => {
  try {
    res.status(200).json(await getUserWaitlists(String(req.user._id), models));
  } catch (error) {
    console.log("Error in getMyWaitlists controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// DELETE /api/v1/waitlist/:id
export const cancelWaitlistController = async (req, res) => {
  try {
    const updated = await cancelWaitlistEntry(req.params.id, String(req.user._id), models);
    if (!updated) return res.status(404).json({ message: "waitlist entry not found" });
    res.status(200).json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
