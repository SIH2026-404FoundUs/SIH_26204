import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getAlertsController, getAlertsForTripController, ingestAlertController } from "../controllers/alerts.controller.js";

const router = express.Router();

router.get("/", getAlertsController); // public safety advisories, spec §3.3
// Same public-read posture, just filtered by a trip's own dates instead of
// "right now" (traveller Notifications, UI spec §8/9).
router.get("/for-trip", getAlertsForTripController);
router.post("/", protectRoute, ingestAlertController);

export default router;
