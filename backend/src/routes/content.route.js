import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/requireRole.js";
import { transcribeController, generateContentController, uploadAudioMiddleware } from "../controllers/content.controller.js";

// Tourism Publicity Generator -- operator-only end to end (route-level
// requireRole("operator") is the actual authorization boundary; the
// frontend nav entry is UX-only, same convention as every other role gate
// in this app).
const router = express.Router();

router.use(protectRoute, requireRole("operator"));
router.post("/transcribe", uploadAudioMiddleware, transcribeController);
router.post("/generate", generateContentController);

export default router;
