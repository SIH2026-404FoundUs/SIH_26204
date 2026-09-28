import Business from "../models/business.model.js";
import Visit from "../models/visit.model.js";
import Feedback from "../models/feedback.model.js";
import AuditLog from "../models/auditLog.model.js";
import { submitTouristFeedback, processBusinessFeedback, getBusinessFeedbackInsights } from "../services/feedback/feedbackService.js";
import { logger } from "../lib/logger.js";

const models = { FeedbackModel: Feedback, BusinessModel: Business, AuditLogModel: AuditLog };

// feedbackService.js's VALID_CATEGORIES is a fixed 5-item enum
// (hotel/restaurant/attraction/transport/service) that doesn't map 1:1 onto
// Business.type -- derived server-side rather than left for the traveller to
// pick, so a submission can never be filed under a category that
// contradicts the business's own real type.
const CATEGORY_BY_BUSINESS_TYPE = {
  homestay: "hotel",
  guesthouse: "hotel",
  hotel: "hotel",
  restaurant: "restaurant",
  guide: "service",
  driver: "service",
  cook: "service",
};

// POST /v1/feedback  { businessId, rating, comment } -- gated to a real
// verified visit at THIS business (same Visit collection Proof-of-Visit
// writes to), not just "any visit anywhere" the way Suggest a Place's gate
// works -- a review should come from someone who can prove they were
// actually at this specific place.
export const submitFeedbackController = async (req, res) => {
  try {
    const { businessId, rating, comment } = req.body;
    if (!businessId) return res.status(400).json({ message: "businessId is required" });

    const business = await Business.findById(businessId).lean();
    if (!business) return res.status(404).json({ message: "business not found" });

    const hasVerifiedVisit = await Visit.exists({ userId: String(req.user._id), businessId, status: "verified" });
    if (!hasVerifiedVisit) {
      return res.status(403).json({ message: "A verified visit to this business is required before leaving feedback" });
    }

    const category = CATEGORY_BY_BUSINESS_TYPE[business.type] || "service";
    const result = await submitTouristFeedback(
      { userId: String(req.user._id), businessId, destId: business.destId, category, rating, comment },
      models
    );
    res.status(result.status).json(result);
  } catch (error) {
    logger.error("Error in submitFeedback controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// GET /v1/feedback/business/:id/insights -- operator-only, own business
// only. Fast path: reads whatever's cached on the Business doc, or
// computes the heuristic extraction on the fly if nothing's cached yet
// and the review count already clears MIN_FEEDBACK_THRESHOLD (see
// getBusinessFeedbackInsights's own doc comment).
export const getFeedbackInsightsController = async (req, res) => {
  try {
    if (req.user.role !== "operator") return res.status(403).json({ message: "operator role required" });
    const business = await Business.findOne({ _id: req.params.id, ownerUserId: String(req.user._id) });
    if (!business) return res.status(404).json({ message: "business not found" });

    const result = await getBusinessFeedbackInsights(req.params.id, models);
    res.status(200).json(result);
  } catch (error) {
    logger.error("Error in getFeedbackInsights controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// POST /v1/feedback/business/:id/process -- operator-only, own business
// only. Runs the full pipeline (translate non-English reviews, then
// extract themes/actions) and caches the result onto the Business doc.
// No aiServiceUrl/fetchClient is passed here: the LLM path
// (/internal/ai/feedback-themes on ai-service) isn't built yet, so this
// honestly runs the keyword-heuristic extractor every time (themeSource
// comes back "heuristic-fallback", never mislabeled as "llm") rather than
// silently failing against an endpoint that doesn't exist.
export const processFeedbackController = async (req, res) => {
  try {
    if (req.user.role !== "operator") return res.status(403).json({ message: "operator role required" });
    const business = await Business.findOne({ _id: req.params.id, ownerUserId: String(req.user._id) });
    if (!business) return res.status(404).json({ message: "business not found" });

    const result = await processBusinessFeedback(req.params.id, models);
    res.status(result.status).json(result);
  } catch (error) {
    logger.error("Error in processFeedback controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
