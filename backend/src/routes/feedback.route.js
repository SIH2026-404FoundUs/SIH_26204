import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { submitFeedbackController, getFeedbackInsightsController, processFeedbackController } from "../controllers/feedback.controller.js";

// AI Tourist Feedback Intelligence (spec §3.2). Submission is open to any
// authenticated role (role check happens implicitly via the verified-visit
// gate in the controller -- whoever actually visited can review); the two
// insights routes are operator-only, own-business-only (checked in each
// controller).
const router = express.Router();

router.post("/", protectRoute, submitFeedbackController);
router.get("/business/:id/insights", protectRoute, getFeedbackInsightsController);
router.post("/business/:id/process", protectRoute, processFeedbackController);

export default router;
