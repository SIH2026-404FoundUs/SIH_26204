// Voice Onboarding — bharani-tasks.md Section 1.6 internal fallback pipeline.
//
// "Real WhatsApp stays the primary, on-stage path. But also wire an
// internal-only upload endpoint (a raw voice file, not WhatsApp) that
// feeds the exact same Whisper -> Qwen3 -> MongoDB pipeline downstream of
// the webhook. Never present this as the feature."
//
// A Business document IS the draft throughout onboarding — confirmed
// against schema-workplan.md before building this: there is no separate
// draft collection anywhere in the schema (16 collections total, checked
// the full list), and BUSINESSES itself carries both onboardingState and
// lastWhatsAppMessageId directly (bharani-tasks.md §1.1: "State is stored
// on the business draft document, keyed by lastWhatsAppMessageId"). So
// this handler reads/writes the same Business collection the real
// WhatsApp webhook eventually will, in place, from AWAITING_CONSENT
// through to whatever state this request reaches.

import crypto from "crypto";
import multer from "multer";
import Business from "../models/business.model.js";
import { transcribeAudio } from "../services/onboarding/transcription.js";
import { validateExtractionShape, checkExtractionHonesty } from "../services/onboarding/extraction.js";
import { transitionDraft, ONBOARDING_STATES } from "../services/onboarding/stateMachine.js";

const MAX_AUDIO_BYTES = 20 * 1024 * 1024; // 20MB — comfortably above any real WhatsApp voice note

export const uploadAudioMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AUDIO_BYTES },
}).single("audio");

/**
 * Advances an in-memory draft state from `startState` through every
 * intermediate state up to and including `targetState`, one
 * transitionDraft() call per hop (the state machine only allows single
 * hops, so a fresh draft walking from nothing to TRANSCRIBING takes
 * several calls: null->AWAITING_CONSENT->AWAITING_VOICE->TRANSCRIBING).
 *
 * Each hop is given its own synthetic sub-id and a synthetic draft with
 * lastWhatsAppMessageId always null, so transitionDraft's idempotency
 * branch never fires mid-walk — idempotency for the whole request is
 * handled once, up front, by the caller, before this ever runs.
 *
 * @returns {{ ok: boolean, state: string|null, appliedHops?: string[], reason?: string }}
 */
function walkStates(startState, targetState, baseMessageId) {
  const startIndex = startState === null ? -1 : ONBOARDING_STATES.indexOf(startState);
  const targetIndex = ONBOARDING_STATES.indexOf(targetState);

  if (startIndex > targetIndex) {
    return { ok: false, reason: "already_past_target", state: startState };
  }

  let state = startState;
  const appliedHops = [];
  const hopStates = ONBOARDING_STATES.slice(startIndex + 1, targetIndex + 1);

  for (let i = 0; i < hopStates.length; i++) {
    const nextState = hopStates[i];
    const result = transitionDraft(
      { onboardingState: state, lastWhatsAppMessageId: null },
      nextState,
      `${baseMessageId}::step${i + 1}`
    );
    if (!result.applied) {
      return { ok: false, reason: result.reason, state };
    }
    state = result.state;
    appliedHops.push(nextState);
  }

  return { ok: true, state, appliedHops };
}

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
 * "not implemented yet" stub — correct behavior, since the real
 * faster-whisper backend isn't wired up yet either; this endpoint should
 * fail the same loud, clear way the WhatsApp path would if unconfigured.
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

      const existing = await Business.findOne({ ownerPhone });
      const currentState = existing ? existing.onboardingState ?? null : null;
      const attemptMessageId = messageId || crypto.randomUUID();

      // Whole-request idempotency: a genuinely replayed upload (same
      // messageId already persisted on this draft) does zero work — no
      // transcription, no extraction, no writes.
      if (existing?.lastWhatsAppMessageId != null && existing.lastWhatsAppMessageId === attemptMessageId) {
        return res.status(200).json({
          businessId: existing._id,
          onboardingState: existing.onboardingState,
          applied: false,
          reason: "duplicate_message",
        });
      }

      const preCheck = walkStates(currentState, "TRANSCRIBING", attemptMessageId);
      if (!preCheck.ok) {
        return res.status(409).json({
          error: true,
          message: `draft is not eligible for this endpoint (currently at ${currentState ?? "no state"})`,
          reason: preCheck.reason,
        });
      }

      // Step 2: transcribe (Whisper -> Qwen3 pipeline, Section 1.2).
      const { transcript, detectedLanguage } = await transcribeAudio(req.file.buffer, transcribeFn);

      const shapeResult = validateExtractionShape(extractedFields);
      const honestyResult = shapeResult.valid
        ? checkExtractionHonesty(extractedFields, transcript)
        : { honest: false, failedFields: [] };
      const extractionAccepted = shapeResult.valid && honestyResult.honest;

      const setOnSave = {
        ownerPhone,
        destId,
        rawTranscript: transcript,
        transcriptLang: detectedLanguage,
        onboardingState: preCheck.state, // TRANSCRIBING, unless the EXTRACTING hop below succeeds too
      };
      let appliedHops = preCheck.appliedHops;

      // Step 4: only advance past TRANSCRIBING, and only persist the
      // extracted fields, when the extraction was both well-formed and
      // honest. A failed check does NOT silently drop the rejection — it's
      // reported in full below — but it also must not advance the draft.
      if (extractionAccepted) {
        const extractStep = transitionDraft(
          { onboardingState: preCheck.state, lastWhatsAppMessageId: null },
          "EXTRACTING",
          `${attemptMessageId}::step_extract`
        );
        if (extractStep.applied) {
          appliedHops = [...appliedHops, "EXTRACTING"];
          Object.assign(setOnSave, extractedFields, { onboardingState: "EXTRACTING" });
        }
      }

      // Merged independently of the extraction accept/reject outcome above
      // — these were never part of that pipeline, so a rejected extraction
      // must not withhold them.
      if (staffSkillsResult.value !== undefined) {
        setOnSave.staff_skills = staffSkillsResult.value;
      }
      if (staffServiceAreaResult.value !== undefined) {
        setOnSave.staff_serviceAreaDestIds = staffServiceAreaResult.value;
      }

      // Schema validators run on this write (enum checks, priceRangeINR
      // shape, etc. all apply). name/type are the one deliberate
      // exception: business.model.js makes them required only once
      // onboardingState reaches LIVE, matching transitionDraft()'s own
      // hasRequiredFieldsForLive() gate on that same transition — a draft
      // sitting at TRANSCRIBING/EXTRACTING with name/type still unknown
      // is legitimate and must still be saveable.
      const draftId = existing ? existing._id : `biz_${destId}_${crypto.randomUUID()}`;
      setOnSave.lastWhatsAppMessageId = attemptMessageId;
      const saved = await Business.findOneAndUpdate(
        { _id: draftId },
        { $set: setOnSave },
        { upsert: true, new: true, runValidators: true, context: "query" }
      );

      return res.status(extractionAccepted ? 200 : 422).json({
        businessId: saved._id,
        onboardingState: saved.onboardingState,
        appliedHops,
        transcript,
        detectedLanguage,
        extraction: {
          shapeValid: shapeResult.valid,
          shapeErrors: shapeResult.errors,
          honest: honestyResult.honest,
          failedFields: honestyResult.failedFields,
        },
      });
    } catch (error) {
      console.error("Error in onboarding upload handler:", error.message);
      return res.status(500).json({ error: true, message: error.message });
    }
  };
}
