import {
  createWaitlistEntry,
  getUserWaitlists,
  cancelWaitlistEntry,
} from "../services/waitlist/waitlistService.js";
import Waitlist from "../models/waitlist.model.js";
import Business from "../models/business.model.js";

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

// GET /api/v1/waitlist/business/:businessId — the SmartWaitlist entries an
// operator can actually act on (spec §2's "same destId is the whole
// definition of nearby"): everyone still waiting for an opening in this
// business's destination, so the operator can decide whether to open an
// offer. Ownership-checked the same way offers.controller.js already does
// for offer creation -- an operator can only ever see this for a business
// they actually own. Never returns the waiting traveller's userId: an
// operator doesn't contact them directly, the platform's own
// processOfferMatching() notification fan-out does that once an offer
// exists, so there's nothing here for a raw userId to be used for.
export const getBusinessWaitlistController = async (req, res) => {
  try {
    if (req.user.role !== "operator") {
      return res.status(403).json({ message: "operator role required" });
    }
    const business = await Business.findById(req.params.businessId).select("ownerUserId destId");
    if (!business) return res.status(404).json({ message: "business not found" });
    if (String(business.ownerUserId || "") !== String(req.user._id)) {
      return res.status(403).json({ message: "business owner role required" });
    }

    const entries = await Waitlist.find({ destId: business.destId, state: "waiting" })
      .select("-userId")
      .sort({ createdAt: 1 })
      .lean();
    res.status(200).json(entries);
  } catch (error) {
    console.log("Error in getBusinessWaitlist controller", error.message);
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
