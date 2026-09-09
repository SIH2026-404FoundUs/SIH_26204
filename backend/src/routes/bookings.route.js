import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  createBookingController,
  getMyBookingsController,
  getBusinessBookingsController,
} from "../controllers/bookings.controller.js";

const router = express.Router();

router.post("/", protectRoute, createBookingController);
router.get("/mine", protectRoute, getMyBookingsController);
router.get("/business/:businessId", protectRoute, getBusinessBookingsController);

export default router;
