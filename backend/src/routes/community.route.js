import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  submitSubmissionController,
  getQueuedSubmissionsController,
  getMySubmissionsController,
  getApprovedSubmissionsController,
  getNearbySuggestionCountController,
  reviewSubmissionController,
  uploadPhotosMiddleware,
  uploadPhotosController,
} from "../controllers/community.controller.js";

const router = express.Router();

router.post("/photos", protectRoute, uploadPhotosMiddleware, uploadPhotosController);
router.post("/submissions", protectRoute, submitSubmissionController); // spec §3.1
router.get("/submissions/queued", protectRoute, getQueuedSubmissionsController);
router.get("/submissions/mine", protectRoute, getMySubmissionsController);
// Public reads -- Community Forum feed + the landing page's "suggested
// places" section, and the trip-planner's "N people have suggested nearby"
// count. Same posture as /v1/businesses/search, /v1/alerts.
router.get("/submissions/approved", getApprovedSubmissionsController);
router.get("/nearby-count", getNearbySuggestionCountController);
router.post("/submissions/:id/review", protectRoute, reviewSubmissionController);

export default router;
