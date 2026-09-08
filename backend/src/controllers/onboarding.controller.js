// Voice Onboarding — bharani-tasks.md Section 1.6 internal fallback pipeline.
//
// "Real WhatsApp stays the primary, on-stage path. But also wire an
// internal-only upload endpoint (a raw voice file, not WhatsApp) that
// feeds the exact same Whisper -> Qwen3 -> MongoDB pipeline downstream of
// the webhook. Never present this as the feature."
//
// The actual pipeline (transcribe -> validate/honesty-check -> advance
// state -> persist) lives in services/onboarding/processInboundAudio.js,
// shared with whatsappWebhook.controller.js — this file is now just the
// HTTP adapter around it: parsing the multipart request, validating the
// placeholder inputs, and translating the shared core's result into HTTP
// responses.

import multer from "multer";
import { processInboundAudio } from "../services/onboarding/processInboundAudio.js";

const MAX_AUDIO_BYTES = 20 * 1024 * 1024; // 20MB — comfortably above any real WhatsApp voice note

export const uploadAudioMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AUDIO_BYTES },
}).single("audio");

/**
 * Parses an optional request field expected to be a JSON-encoded array of
 * strings (staff_skills / staff_serviceAreaDestIds). Returns
 * { ok: true, value: undefined } when the field wasn't supplied at all —
 * that's the normal case for a non-staff listing, not an error.
 */
function parseOptionalStringArray(rawValue, fieldName) {
  if (rawValue === undefined) {
    return { ok: true, value: undefined };
  }
  let parsed;
  try {
    parsed = typeof rawValue === "string" ? JSON.parse(rawValue) : rawValue;
  } catch {
    return { ok: false, error: `${fieldName} must be valid JSON` };
  }
  if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string")) {
    return { ok: false, error: `${fieldName} must be an array of strings` };
  }
  return { ok: true, value: parsed };
}

/**
 * Builds the internal onboarding-upload handler. `transcribeFn` is
 * injectable for tests, exactly like eligibility.js's pressureFn.
 * Production callers omit it, and transcribeAudio() falls back to its own
 * real HTTP-backed default — correct behavior; this endpoint should fail
 * the same loud, clear way the WhatsApp path would if unconfigured.
 *
 * @param {Object} [deps]
 * @param {Function} [deps.transcribeFn]
 */
export function createOnboardingUploadHandler({ transcribeFn } = {}) {
  return async function handleOnboardingUpload(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: true, message: 'audio file is required (multipart field "audio")' });
      }

      const { destId, ownerPhone, messageId } = req.body;
      if (!destId || !ownerPhone) {
        return res.status(400).json({ error: true, message: "destId and ownerPhone are required" });
      }

      // PLACEHOLDER for the real Qwen3 extraction call (Section 1.3) — not
      // built yet. Caller supplies the extracted fields directly so the
      // rest of the pipeline (shape + honesty checks, state advancement,
      // persistence) can be exercised end-to-end without a live LLM.
      let extractedFields;
      try {
        extractedFields =
          typeof req.body.extractedFields === "string"
            ? JSON.parse(req.body.extractedFields)
            : req.body.extractedFields;
      } catch {
        return res.status(400).json({ error: true, message: "extractedFields must be valid JSON" });
      }
      if (!extractedFields || typeof extractedFields !== "object") {
        return res.status(400).json({
          error: true,
          message:
            "extractedFields is required for now (placeholder for the real Qwen3 call, Section 1.3, " +
            "not built yet) — pass the fields you want validated directly in the request body.",
        });
      }

      // staff_skills/staff_serviceAreaDestIds collection mechanism is
      // unspecified in bharani-tasks.md Section 1.4 -- this fallback
      // endpoint accepts them as direct input as a placeholder; the real
      // WhatsApp flow will need an actual follow-up-question mechanism
      // once built, likely a FOLLOWUP-state extension gated on type. This
      // is a documented assumption, not a silent guess. Optional and
      // never LIVE-blocking (deliberately not in REQUIRED_FIELDS_FOR_LIVE
      // / hasRequiredFieldsForLive() — Section 1.3's "Required for LIVE"
      // list is unconditional and correctly excludes them), and parsed
      // independently of extractedFields since they were never part of
      // Section 1.3's extraction schema and must not go through
      // validateExtractionShape.
      const staffSkillsResult = parseOptionalStringArray(req.body.staff_skills, "staff_skills");
      if (!staffSkillsResult.ok) {
        return res.status(400).json({ error: true, message: staffSkillsResult.error });
      }
      const staffServiceAreaResult = parseOptionalStringArray(
        req.body.staff_serviceAreaDestIds,
        "staff_serviceAreaDestIds"
      );
      if (!staffServiceAreaResult.ok) {
        return res.status(400).json({ error: true, message: staffServiceAreaResult.error });
      }

      const extraFields = {};
      if (staffSkillsResult.value !== undefined) {
        extraFields.staff_skills = staffSkillsResult.value;
      }
      if (staffServiceAreaResult.value !== undefined) {
        extraFields.staff_serviceAreaDestIds = staffServiceAreaResult.value;
      }

      const result = await processInboundAudio({
        audioBuffer: req.file.buffer,
        destId,
        ownerPhone,
        messageId,
        extractedFields,
        extraFields,
        transcribeFn,
      });

      if (!result.applied) {
        if (result.reason === "duplicate_message") {
          return res.status(200).json({
            businessId: result.businessId,
            onboardingState: result.onboardingState,
            applied: false,
            reason: "duplicate_message",
          });
        }
        return res.status(409).json({
          error: true,
          message: `draft is not eligible for this endpoint (currently at ${result.onboardingState ?? "no state"})`,
          reason: result.reason,
        });
      }

      return res.status(result.extractionAccepted ? 200 : 422).json({
        businessId: result.businessId,
        onboardingState: result.onboardingState,
        appliedHops: result.appliedHops,
        transcript: result.transcript,
        detectedLanguage: result.detectedLanguage,
        extraction: result.extraction,
      });
    } catch (error) {
      console.error("Error in onboarding upload handler:", error.message);
      return res.status(500).json({ error: true, message: error.message });
    }
  };
}
