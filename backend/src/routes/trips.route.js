import express from "express";
import { protectRouteOrService } from "../middleware/serviceAuth.middleware.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/requireRole.middleware.js";
import {
  createTripController, getTripController, updateTripController, listTripsController,
  getTripsSummaryController,
} from "../controllers/trips.controller.js";

const router = express.Router();

router.use(protectRouteOrService);
router.post("/", createTripController);
router.get("/", listTripsController);
// Must come before /:id -- otherwise "summary" would be captured as an :id
// value and rejected by the ObjectId guard instead of reaching this handler.
router.get("/summary", protectRoute, requireRole("authority"), getTripsSummaryController);
router.get("/:id", getTripController);
router.patch("/:id", updateTripController);

export default router;
