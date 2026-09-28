import { createOffer, claimOfferAtomic } from "../services/waitlist/offerService.js";
import { processOfferMatching } from "../services/waitlist/waitlistService.js";
import Offer from "../models/offer.model.js";
import Waitlist from "../models/waitlist.model.js";
import AuditLog from "../models/auditLog.model.js";
import Business from "../models/business.model.js";
import User from "../models/user.model.js";
import { sendMail } from "../lib/mailer.js";
import { flashOfferEmail, waitlistFulfilledEmail } from "../lib/emailTemplates.js";
import { parsePagination } from "../lib/pagination.js";
import { logger } from "../lib/logger.js";

const models = { OfferModel: Offer, WaitlistModel: Waitlist, AuditLogModel: AuditLog };
const APP_URL = (process.env.CLIENT_URL || "http://localhost:5173").split(",")[0].trim();

// Best-effort email fan-out to every matched waitlist recipient -- the
// in-app bell (useNotificationsStore) already reads the exact same
// notificationHistory processOfferMatching just wrote; this is the email
// fallback for a traveller who isn't watching the app right now. Never
// blocks or fails the offer-creation response.
async function notifyRecipientsByEmail(recipients, offer) {
  if (recipients.length === 0) return;
  const users = await User.find({ _id: { $in: recipients.map((r) => r.userId) } }).select("email fullName").catch(() => []);
  const byId = new Map(users.map((u) => [String(u._id), u]));
  await Promise.all(
    recipients.map((r) => {
      const user = byId.get(String(r.userId));
      if (!user) return null;
      return sendMail({
        to: user.email,
        ...flashOfferEmail({ fullName: user.fullName, destId: offer.destId, discountPct: offer.discountPct, effectivePrice: offer.effectivePrice, appUrl: APP_URL }),
      }).catch(() => {});
    })
  );
}

// POST /api/v1/offers — an operator/authority opens a cancelled-slot flash offer
// (spec §2), which immediately fans out to matching waitlists (spec §2.2).
export const createOfferController = async (req, res) => {
  try {
    if (!["operator", "authority"].includes(req.user.role)) {
      return res.status(403).json({ message: "operator or authority role required" });
    }
    if (req.user.role === "operator") {
      const business = await Business.findById(req.body.businessId).select("ownerUserId");
      if (!business) return res.status(404).json({ message: "business not found" });
      if (String(business.ownerUserId || "") !== String(req.user._id)) {
        return res.status(403).json({ message: "business owner role required" });
      }
    }
    const offer = await createOffer(req.body, models);
    const { matchCount, recipients } = await processOfferMatching(offer, models);
    notifyRecipientsByEmail(recipients, offer).catch(() => {}); // fire-and-forget, never delays the response
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
    const { limit, skip } = parsePagination(req.query, { defaultLimit: 50 });
    const offers = await Offer.find({
      destId,
      status: "open",
      expiresAt: { $gt: new Date() },
    }).sort({ expiresAt: 1 }).skip(skip).limit(limit);
    res.status(200).json(offers);
  } catch (error) {
    logger.error("Error in listOffers controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// POST /api/v1/offers/:id/claim — the atomic single-winner claim (spec §2). This
// is the actual bug fix: findOneAndUpdate against one shared OFFERS document
// instead of a read-then-write race across up to 20 separate WAITLISTS rows.
export const claimOfferController = async (req, res) => {
  try {
    const result = await claimOfferAtomic(req.params.id, String(req.user._id), models);
    if (result.success) {
      sendMail({
        to: req.user.email,
        ...waitlistFulfilledEmail({ fullName: req.user.fullName, destId: result.offer.destId, appUrl: APP_URL }),
      }).catch(() => {});
    }
    res.status(result.status).json(result);
  } catch (error) {
    logger.error("Error in claimOffer controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
