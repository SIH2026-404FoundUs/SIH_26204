import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  createWaitlistController,
  getMyWaitlistsController,
  cancelWaitlistController,
} from "../controllers/waitlist.controller.js";

const router = express.Router();

router.post("/", protectRoute, createWaitlistController);
router.get("/mine", protectRoute, getMyWaitlistsController);
router.delete("/:id", protectRoute, cancelWaitlistController);

export default router;
