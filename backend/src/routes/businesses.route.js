import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  searchBusinessesController,
  registerBusinessController,
  getMyBusinessesController,
  getBusinessContactController,
  getBusinessAvailabilityController,
  upsertBusinessAvailabilityController,
} from "../controllers/businesses.controller.js";

const router = express.Router();

router.get("/search", searchBusinessesController);
router.get("/mine", protectRoute, getMyBusinessesController);
router.get("/:id/availability", protectRoute, getBusinessAvailabilityController);
router.post("/:id/availability", protectRoute, upsertBusinessAvailabilityController);
router.get("/:id/contact", protectRoute, getBusinessContactController);
router.post("/", protectRoute, registerBusinessController);

export default router;
