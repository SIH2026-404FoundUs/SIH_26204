import express from "express";
import { uploadAudioMiddleware, createOnboardingUploadHandler } from "../controllers/onboarding.controller.js";

const router = express.Router();

// POST /api/internal/onboarding/upload — bharani-tasks.md Section 1.6.
// Internal-only demo-safety fallback: NOT the feature. Feeds the same
// Whisper -> Qwen3 -> MongoDB pipeline the real WhatsApp webhook will,
// triggered by a direct file upload instead of a WhatsApp message.
router.post("/upload", uploadAudioMiddleware, createOnboardingUploadHandler());

export default router;
