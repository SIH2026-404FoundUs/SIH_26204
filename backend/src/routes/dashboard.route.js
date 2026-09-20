import express from "express";
import {
  getDashboardPressureController,
  getDashboardCapacityController,
  getDashboardRedistributionController,
  getDashboardAcceptanceController,
  getDashboardLaborController,
  getDashboardSummaryController,
} from "../controllers/dashboard.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/requireRole.js";

const router = express.Router();

// Every dashboard route: authenticated (401 if not) AND role === "authority"
// (403 otherwise). Applied once at the router level rather than repeated on
// each route.
router.use(protectRoute, requireRole("authority"));

router.get("/summary", getDashboardSummaryController);
router.get("/pressure", getDashboardPressureController);
router.get("/capacity", getDashboardCapacityController);
router.get("/redistribution", getDashboardRedistributionController);
router.get("/acceptance", getDashboardAcceptanceController);
router.get("/labor", getDashboardLaborController);

export default router;
