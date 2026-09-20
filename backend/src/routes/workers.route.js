import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/requireRole.js";
import {
  upsertWorkerProfileController,
  getMyWorkerProfileController,
  updateAvailabilityController,
  getMyGigsController,
} from "../controllers/workers.controller.js";

// Worker role -- worker-only end to end (route-level requireRole("worker")
// is the real authorization boundary, same convention as content.route.js).
const router = express.Router();

router.use(protectRoute, requireRole("worker"));
router.post("/", upsertWorkerProfileController);
router.get("/me", getMyWorkerProfileController);
router.patch("/me/availability", updateAvailabilityController);
router.get("/me/gigs", getMyGigsController);

export default router;
