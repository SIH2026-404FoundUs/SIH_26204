import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { broadcastAlertLimiter } from "../middleware/authRateLimit.js";
import {
  sendBroadcastAlertController,
  getActiveBroadcastAlertsController,
  resolveBroadcastAlertController,
} from "../controllers/broadcastAlerts.controller.js";

const router = express.Router();

router.get("/", getActiveBroadcastAlertsController);
router.post("/", protectRoute, broadcastAlertLimiter, sendBroadcastAlertController);
router.patch("/:id/resolve", protectRoute, resolveBroadcastAlertController);

export default router;
