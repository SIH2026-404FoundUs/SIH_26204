import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  getEmergencyContactsController,
  createShareableTripController,
  getShareableTripController,
  revokeShareableTripController,
  submitComplaintController,
  getMyComplaintsController,
} from "../controllers/safety.controller.js";

const router = express.Router();

router.get("/emergency-contacts/:destId", getEmergencyContactsController);
router.post("/trips/share", protectRoute, createShareableTripController);
router.get("/trips/share/:token", getShareableTripController);
router.post("/trips/share/:token/revoke", protectRoute, revokeShareableTripController);
router.post("/complaints", protectRoute, submitComplaintController);
router.get("/complaints/mine", protectRoute, getMyComplaintsController);

export default router;
