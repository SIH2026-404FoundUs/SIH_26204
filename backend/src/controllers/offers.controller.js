import { createOffer, claimOfferAtomic } from "../services/waitlist/offerService.js";
import { processOfferMatching } from "../services/waitlist/waitlistService.js";
import Offer from "../models/offer.model.js";
import Waitlist from "../models/waitlist.model.js";
import AuditLog from "../models/auditLog.model.js";

const models = { OfferModel: Offer, WaitlistModel: Waitlist, AuditLogModel: AuditLog };

// POST /api/v1/offers — an operator/authority opens a cancelled-slot flash offer
// (spec §2), which immediately fans out to matching waitlists (spec §2.2).
export const createOfferController = async (req, res) => {
  try {
    if (!["operator", "authority"].includes(req.user.role)) {
      return res.status(403).json({ message: "operator or authority role required" });
    }
    const offer = await createOffer(req.body, models);
    const { matchCount } = await processOfferMatching(offer, models);
    res.status(201).json({ offer, notified: matchCount });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// GET /api/v1/offers?destId= — open, unexpired offers for a destination.
// Needed for the frontend to show something claimable; nothing else in the
// codebase queries this list.
export const listOffersController = async (req, res) => {
  try {
    const { destId } = req.query;
    if (!destId) return res.status(400).json({ message: "destId query param required" });
    const offers = await Offer.find({
      destId,
      status: "open",
      expiresAt: { $gt: new Date() },
    }).sort({ expiresAt: 1 });
    res.status(200).json(offers);
  } catch (error) {
    console.log("Error in listOffers controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// POST /api/v1/offers/:id/claim — the atomic single-winner claim (spec §2). This
// is the actual bug fix: findOneAndUpdate against one shared OFFERS document
// instead of a read-then-write race across up to 20 separate WAITLISTS rows.
export const claimOfferController = async (req, res) => {
  try {
    const result = await claimOfferAtomic(req.params.id, String(req.user._id), models);
    res.status(result.status).json(result);
  } catch (error) {
    console.log("Error in claimOffer controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
