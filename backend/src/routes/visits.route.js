import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { verifyVisitController, getOperatorCodeController } from "../controllers/visits.controller.js";

const router = express.Router();

router.post("/verify", protectRoute, verifyVisitController); // spec §1.2
router.get("/operator-code/:businessId", getOperatorCodeController); // spec §1.1

export default router;
