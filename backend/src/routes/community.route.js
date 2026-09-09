import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  submitSubmissionController,
  getQueuedSubmissionsController,
  getMySubmissionsController,
  reviewSubmissionController,
  uploadPhotosMiddleware,
  uploadPhotosController,
} from "../controllers/community.controller.js";

const router = express.Router();

router.post("/photos", protectRoute, uploadPhotosMiddleware, uploadPhotosController);
router.post("/submissions", protectRoute, submitSubmissionController); // spec §3.1
router.get("/submissions/queued", protectRoute, getQueuedSubmissionsController);
router.get("/submissions/mine", protectRoute, getMySubmissionsController);
router.post("/submissions/:id/review", protectRoute, reviewSubmissionController);

export default router;
