import Alert from "../models/alert.model.js";
import TravelEducation from "../models/travelEducation.model.js";
import {
  getEducationForTraveller,
  getEducationSummary,
  getEducationSection,
  upsertEducation,
  addEducationFeedback,
} from "../services/education/educationService.js";
import { logger } from "../lib/logger.js";

const models = { TravelEducationModel: TravelEducation, AlertModel: Alert };

// GET /api/v1/destinations/:destId/education
export const getEducationController = async (req, res) => {
  try {
    const result = await getEducationForTraveller(req.params.destId, models);
    res.status(result.status).json(result.success ? result : { message: result.message });
  } catch (error) {
    logger.error("Error in getEducation controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// GET /api/v1/destinations/:destId/education/summary
export const getEducationSummaryController = async (req, res) => {
  try {
    const result = await getEducationSummary(req.params.destId, models);
    res.status(result.status).json(result.success ? result : { message: result.message });
  } catch (error) {
    logger.error("Error in getEducationSummary controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// GET /api/v1/destinations/:destId/education/packing
export const getEducationPackingController = async (req, res) => {
  try {
    const result = await getEducationSection(req.params.destId, "packing", models);
    res.status(result.status).json(result.success ? result : { message: result.message });
  } catch (error) {
    logger.error("Error in getEducationPacking controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// GET /api/v1/destinations/:destId/education/safety
export const getEducationSafetyController = async (req, res) => {
  try {
    const result = await getEducationSection(req.params.destId, "safety", models);
    res.status(result.status).json(result.success ? result : { message: result.message });
  } catch (error) {
    logger.error("Error in getEducationSafety controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// POST /api/v1/destinations/:destId/education/feedback -- any signed-in traveller
export const submitEducationFeedbackController = async (req, res) => {
  try {
    const { helpful, comment } = req.body;
    const result = await addEducationFeedback(req.params.destId, req.user._id, { helpful, comment }, models);
    res.status(result.status).json(result.success ? result : { message: result.message });
  } catch (error) {
    logger.error("Error in submitEducationFeedback controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// PUT /api/v1/destinations/:destId/education -- authority-authored content
// only (this codebase already treats "authority" as the content-quality/
// moderation role -- Community Review, complaint status changes). Never
// called by AI tooling or any traveller-facing flow -- §15's "no invented
// education facts" is enforced by WHO can write here, not just what's read.
export const upsertEducationController = async (req, res) => {
  try {
    if (req.user.role !== "authority") {
      return res.status(403).json({ message: "authority role required" });
    }
    const result = await upsertEducation(req.params.destId, req.body, models);
    res.status(result.status).json(result.success ? result : { message: result.message });
  } catch (error) {
    logger.error("Error in upsertEducation controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
