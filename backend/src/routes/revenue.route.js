import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getRevenueDashboardController, simulateRevenueController } from "../controllers/revenue.controller.js";

// Operator Revenue Management System -- operator-only end to end (route-level
// protectRoute + the controller's own ownership check are the real
// authorization boundary, same convention as content.route.js/
// businesses.route.js). Purely additive: new routes only, nothing here
// touches any traveller- or authority-facing route or controller.
const router = express.Router();

router.use(protectRoute);
router.get("/:businessId/dashboard", getRevenueDashboardController);
router.post("/:businessId/simulate", simulateRevenueController);

export default router;
