import multer from "multer";
import { generateContent, transcribeVoice } from "../services/content/contentGeneratorService.js";

const MAX_AUDIO_BYTES = 20 * 1024 * 1024; // 20MB -- comfortably covers a few minutes of voice input

export const uploadAudioMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AUDIO_BYTES },
}).single("audio");

// POST /v1/content/transcribe -- Whisper large-v3 (Groq) transcription for
// the Content Generator's voice input mode. Route-level requireRole
// ("operator") is the real authorization boundary; nothing here re-checks
// role.
export const transcribeController = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "audio file is required (field name: audio)" });
    const result = await transcribeVoice(req.file.buffer, req.file.originalname);
    res.status(200).json(result);
  } catch (error) {
    console.log("Error in transcribe controller", error.message);
    if (error.code === "MISSING_ENV") return res.status(503).json({ message: "Voice transcription is not configured on this server yet" });
    res.status(500).json({ message: "Could not transcribe audio" });
  }
};

// POST /v1/content/generate -- text-or-transcribed-text in, N marketing
// copy variants out. businessId is optional: when supplied (and actually
// owned by this operator), its real name/price/discount/amenities ground
// the generation instead of relying only on whatever the operator typed.
export const generateContentController = async (req, res) => {
  try {
    const { rawText, businessId, language, platform, tone, variantCount } = req.body;
    const result = await generateContent({
      rawText,
      businessId: businessId || null,
      ownerUserId: req.user._id,
      language,
      platform,
      tone,
      variantCount,
    });
    res.status(200).json(result);
  } catch (error) {
    console.log("Error in generateContent controller", error.message);
    const status = error.status || (error.code === "MISSING_ENV" ? 503 : 500);
    res.status(status).json({ message: status < 500 ? error.message : "Could not generate content right now" });
  }
};
