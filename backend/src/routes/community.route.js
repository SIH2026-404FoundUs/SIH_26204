import express from "express";
import { protectRoute, optionalAuth } from "../middleware/auth.middleware.js";
import {
  submitSubmissionController,
  getQueuedSubmissionsController,
  getMySubmissionsController,
  getApprovedSubmissionsController,
  getNearbySuggestionCountController,
  reviewSubmissionController,
  reactToSubmissionController,
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
// count. Same posture as /v1/businesses/search, /v1/alerts. optionalAuth
// (not protectRoute) on the approved feed so it personalizes with the
// viewer's own like/dislike when they're logged in, without requiring it.
router.get("/submissions/approved", optionalAuth, getApprovedSubmissionsController);
router.get("/nearby-count", getNearbySuggestionCountController);
router.post("/submissions/:id/review", protectRoute, reviewSubmissionController);
router.post("/submissions/:id/react", protectRoute, reactToSubmissionController);

export default router;
