import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  createWaitlistController,
  getMyWaitlistsController,
  getBusinessWaitlistController,
  cancelWaitlistController,
  getMyOfferNotificationsController,
  declineOfferNotificationController,
} from "../controllers/waitlist.controller.js";

const router = express.Router();

router.post("/", protectRoute, createWaitlistController);
router.get("/mine", protectRoute, getMyWaitlistsController);
router.get("/notifications", protectRoute, getMyOfferNotificationsController);
// Before "/:id" -- "business" would otherwise be swallowed as an :id value.
router.get("/business/:businessId", protectRoute, getBusinessWaitlistController);
router.post("/:id/decline", protectRoute, declineOfferNotificationController);
router.delete("/:id", protectRoute, cancelWaitlistController);

export default router;
