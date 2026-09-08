import express from "express";
import {
  createTripController, getTripController, updateTripController, listTripsController,
  getTripsSummaryController,
} from "../controllers/trips.controller.js";

const router = express.Router();

router.post("/", createTripController);
router.get("/", listTripsController);
// Must come before /:id -- otherwise "summary" would be captured as an :id
// value and rejected by the ObjectId guard instead of reaching this handler.
router.get("/summary", getTripsSummaryController);
router.get("/:id", getTripController);
router.patch("/:id", updateTripController);

export default router;
