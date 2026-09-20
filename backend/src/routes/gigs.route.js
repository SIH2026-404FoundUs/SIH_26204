import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/requireRole.js";
import {
  listGigsController,
  createGigController,
  acceptGigController,
  completeGigController,
  rateGigController,
} from "../controllers/gigs.controller.js";

// Worker role design spec §05 -- each route's Actor column becomes its own
// requireRole here, rather than one router-level gate, since accept is
// worker-only while complete/rate are either side.
const router = express.Router();

router.use(protectRoute);
router.get("/", requireRole("worker"), listGigsController);
router.post("/", requireRole("operator"), createGigController);
router.post("/:id/accept", requireRole("worker"), acceptGigController);
router.post("/:id/complete", requireRole("worker", "operator"), completeGigController);
router.post("/:id/rate", requireRole("worker", "operator"), rateGigController);

export default router;
