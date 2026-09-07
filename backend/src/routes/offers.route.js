import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { createOfferController, claimOfferController } from "../controllers/offers.controller.js";

const router = express.Router();

router.post("/", protectRoute, createOfferController);
router.post("/:id/claim", protectRoute, claimOfferController); // spec §2 atomic claim

export default router;
