import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  getEducationController,
  getEducationSummaryController,
  getEducationPackingController,
  getEducationSafetyController,
  submitEducationFeedbackController,
  upsertEducationController,
} from "../controllers/education.controller.js";

const router = express.Router({ mergeParams: true });

// Reads are public -- same posture as GET /api/destinations and GET
// /v1/alerts (a destination's education content isn't account-specific).
router.get("/:destId/education", getEducationController);
router.get("/:destId/education/summary", getEducationSummaryController);
router.get("/:destId/education/packing", getEducationPackingController);
router.get("/:destId/education/safety", getEducationSafetyController);
router.post("/:destId/education/feedback", protectRoute, submitEducationFeedbackController);
router.put("/:destId/education", protectRoute, upsertEducationController); // authority-only, checked in the controller

export default router;
