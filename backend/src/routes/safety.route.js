import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  getEmergencyContactsController,
  createShareableTripController,
  getShareableTripController,
  revokeShareableTripController,
  submitComplaintController,
  getMyComplaintsController,
  getAllComplaintsController,
  updateComplaintStatusController,
} from "../controllers/safety.controller.js";

const router = express.Router();

router.get("/emergency-contacts/:destId", getEmergencyContactsController);
router.post("/trips/share", protectRoute, createShareableTripController);
router.get("/trips/share/:token", getShareableTripController);
router.post("/trips/share/:token/revoke", protectRoute, revokeShareableTripController);
router.post("/complaints", protectRoute, submitComplaintController);
router.get("/complaints/mine", protectRoute, getMyComplaintsController);
// Authority moderation -- must be registered before "/complaints/:id/status"
// isn't ambiguous with anything else here, but keep specific-before-param
// ordering as a habit anyway.
router.get("/complaints", protectRoute, getAllComplaintsController);
router.patch("/complaints/:id/status", protectRoute, updateComplaintStatusController);

export default router;
