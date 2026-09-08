import express from "express";
import { createTripController, getTripController, updateTripController } from "../controllers/trips.controller.js";

const router = express.Router();

router.post("/", createTripController);
router.get("/:id", getTripController);
router.patch("/:id", updateTripController);

export default router;
