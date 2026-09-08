import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getAlertsController, ingestAlertController } from "../controllers/alerts.controller.js";

const router = express.Router();

router.get("/", getAlertsController); // public safety advisories, spec §3.3
router.post("/", protectRoute, ingestAlertController);

export default router;
