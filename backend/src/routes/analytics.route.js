import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getOperatorAnalyticsController } from "../controllers/analytics.controller.js";

const router = express.Router();

router.get("/operator", protectRoute, getOperatorAnalyticsController);

export default router;
