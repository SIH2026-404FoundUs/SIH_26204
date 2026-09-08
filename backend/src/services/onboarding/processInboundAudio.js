// Voice Onboarding — the shared pipeline core both the real WhatsApp
// webhook (Section 1.1/1.2) and the internal fallback upload endpoint
// (Section 1.6) converge on: transcribeAudio() -> validateExtractionShape()/
// checkExtractionHonesty() -> transitionDraft() -> persist.
//
// bharani-tasks.md is explicit this must be "the exact same pipeline
// downstream of the webhook" and warns "do not build a second pipeline"
// (Section 1.4, said about the staff branch, but the same principle is
// exactly why this file exists) — this module is that one shared pipeline;
// neither caller re-implements it.

import crypto from "crypto";
import Business from "../../models/business.model.js";
import { transcribeAudio } from "./transcription.js";
import { extractFields } from "./extractFields.js";
import { validateExtractionShape, checkExtractionHonesty } from "./extraction.js";
import { transitionDraft, ONBOARDING_STATES } from "./stateMachine.js";

/**
 * Advances an in-memory draft state from `startState` through every
 * intermediate state up to and including `targetState`, one
 * transitionDraft() call per hop (the state machine only allows single
 * hops, so a fresh draft walking from nothing to TRANSCRIBING takes
 * several calls: null->AWAITING_CONSENT->AWAITING_VOICE->TRANSCRIBING).
 *
 * Each hop is given its own synthetic sub-id and a synthetic draft with
 * lastWhatsAppMessageId always null, so transitionDraft's idempotency
 * branch never fires mid-walk — idempotency for the whole attempt is
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
 * Whether `messageId` is a replay of the last message already persisted
 * for this ownerPhone. Exported so callers that do expensive work BEFORE
 * processInboundAudio (e.g. the WhatsApp webhook downloading media via
 * fetchWhatsAppMedia) can skip that work entirely on a retry, instead of
 * only having processInboundAudio's own internal check no-op the
 * transcription/persist steps after the download already happened. Reuses
 * the exact same comparison processInboundAudio itself does internally —
 * not a second implementation of the idempotency rule.
 */
export async function isDuplicateMessage(ownerPhone, messageId) {
  const existing = await Business.findOne({ ownerPhone });
  return Boolean(existing?.lastWhatsAppMessageId != null && existing.lastWhatsAppMessageId === messageId);
}

/**
 * Runs one inbound-audio processing attempt for a business draft
 * identified by ownerPhone: finds or prepares the draft, checks
 * whole-attempt idempotency against messageId, transcribes, validates and
 * honesty-checks the extraction, advances state accordingly, and persists.
 *
 * destId is required to create a brand-new draft (Business.destId is
 * unconditionally required in the schema) but optional for a draft that
 * already exists — a continuing WhatsApp conversation doesn't need to
 * resupply it. There is currently no way to learn a destId from a WhatsApp
 * message alone (Meta's payload carries no location data, and Qwen3
 * extraction — which might eventually infer one from the transcript —
 * isn't built yet), so a genuinely new draft with no destId available
 * fails clearly here rather than writing an incomplete document or
 * guessing one. This is a real, currently-unbuilt gap, not an oversight.
 *
 * @param {Object} params
 * @param {Buffer} params.audioBuffer
 * @param {string} params.ownerPhone
 * @param {string} params.messageId
 * @param {string} [params.destId] - required only when no draft exists yet.
 * @param {Object|null} [params.extractedFields] - three-way signal, no default:
 *   - omitted entirely (undefined): "no placeholder supplied — actually
 *     attempt real extraction" (the real WhatsApp path, via extractFields()/
 *     extractFn below). This is the ONLY case that triggers a real call.
 *   - explicit null: "extraction not attempted, skip it" — shape/honesty
 *     validation is skipped entirely, the draft never advances past
 *     TRANSCRIBING, nothing extraction-related is written. Kept as an
 *     explicit opt-out for callers that genuinely should not attempt one.
 *   - an object (even all-null fields): used as-is, exactly like before —
 *     this is onboarding.controller.js's placeholder-from-request-body path.
 * @param {Object} [params.extraFields] - merged into the write unconditionally,
 *   independent of the extraction accept/reject outcome (e.g. staff_skills).
 * @param {Function} [params.transcribeFn] - injectable, passed through to transcribeAudio().
 * @param {Function} [params.extractFn] - injectable, passed through to extractFields()
 *   when extractedFields was omitted (real-extraction case only).
 * @returns {Promise<Object>} one of three shapes:
 *   - duplicate: { applied: false, reason: "duplicate_message", businessId, onboardingState }
 *   - not eligible right now: { applied: false, reason: <string>, businessId, onboardingState }
 *   - ran the pipeline: { applied: true, extractionAccepted, businessId, onboardingState,
 *       appliedHops, transcript, detectedLanguage,
 *       extraction: { attempted: false } | { attempted: true, shapeValid, shapeErrors, honest, failedFields } }
 */
export async function processInboundAudio({
  audioBuffer,
  ownerPhone,
  messageId,
  destId,
  extractedFields,
  extraFields = {},
  transcribeFn,
  extractFn,
}) {
  const existing = await Business.findOne({ ownerPhone });

  if (!existing && !destId) {
    throw new Error(
      "processInboundAudio: no existing draft for this ownerPhone and no destId provided — cannot create " +
        "a new draft without one (destId collection for brand-new WhatsApp-originated drafts is not yet built)."
    );
  }

  const currentState = existing ? existing.onboardingState ?? null : null;
  const attemptMessageId = messageId || crypto.randomUUID();

  // Whole-attempt idempotency: a genuinely replayed message (same
  // messageId already persisted on this draft) does zero work — no
  // transcription, no extraction, no writes.
  if (existing?.lastWhatsAppMessageId != null && existing.lastWhatsAppMessageId === attemptMessageId) {
    return {
      applied: false,
      reason: "duplicate_message",
      businessId: existing._id,
      onboardingState: existing.onboardingState,
    };
  }

  const preCheck = walkStates(currentState, "TRANSCRIBING", attemptMessageId);
  if (!preCheck.ok) {
    return {
      applied: false,
      reason: preCheck.reason,
      businessId: existing?._id ?? null,
      onboardingState: currentState,
    };
  }

  const { transcript, detectedLanguage } = await transcribeAudio(audioBuffer, transcribeFn);

  // extractedFields omitted entirely (undefined) is the real WhatsApp
  // case: no placeholder was given, so actually call the real extraction
  // service rather than skipping. Explicit null stays an intentional
  // "don't attempt" opt-out, still supported. See the param doc above for
  // the full three-way contract.
  let effectiveExtractedFields = extractedFields;
  if (extractedFields === undefined) {
    effectiveExtractedFields = await extractFields(transcript, detectedLanguage, extractFn);
  }

  const extractionAttempted = effectiveExtractedFields != null;
  let shapeResult = null;
  let honestyResult = null;
  let extractionAccepted = false;

  if (extractionAttempted) {
    shapeResult = validateExtractionShape(effectiveExtractedFields);
    honestyResult = shapeResult.valid
      ? checkExtractionHonesty(effectiveExtractedFields, transcript)
      : { honest: false, failedFields: [] };
    extractionAccepted = shapeResult.valid && honestyResult.honest;
  }

  const setOnSave = {
    ownerPhone,
    rawTranscript: transcript,
    transcriptLang: detectedLanguage,
    onboardingState: preCheck.state, // TRANSCRIBING, unless the EXTRACTING hop below succeeds too
    ...extraFields,
  };
  if (destId) {
    setOnSave.destId = destId;
  }
  let appliedHops = preCheck.appliedHops;

  // Only advance past TRANSCRIBING, and only persist the extracted
  // fields, when the extraction was both well-formed and honest. A failed
  // check does not silently drop the rejection — it's reported in full in
  // the return value — but it also must not advance the draft.
  if (extractionAccepted) {
    const extractStep = transitionDraft(
      { onboardingState: preCheck.state, lastWhatsAppMessageId: null },
      "EXTRACTING",
      `${attemptMessageId}::step_extract`
    );
    if (extractStep.applied) {
      appliedHops = [...appliedHops, "EXTRACTING"];
      // Only merge fields the extraction actually made a claim about. A
      // null here means "not stated in this message," not "clear this
      // field" — a real extraction attempt legitimately returns null for
      // most fields on any single short message (nobody restates their
      // whole business every time), so blindly Object.assign-ing it in
      // would silently wipe real data an earlier successful extraction
      // already set. This is the same clobbering risk already fixed once
      // for the placeholder-extraction case, reintroduced here through
      // genuine extraction output unless guarded the same way. Array
      // fields (amenities/meals/languages) are never null in the schema
      // — only [] — so they're merged unconditionally, same as before.
      const nonNullExtractedFields = Object.fromEntries(
        Object.entries(effectiveExtractedFields).filter(([, value]) => value !== null)
      );
      Object.assign(setOnSave, nonNullExtractedFields, { onboardingState: "EXTRACTING" });
    }
  }

  // Upsert without full document validation (runValidators still applies —
  // enum/shape checks run — but name/type are conditionally required only
  // once onboardingState reaches LIVE; see business.model.js). destId
  // remains genuinely required on first insert, enforced above rather than
  // left to an opaque Mongoose error.
  const draftId = existing ? existing._id : `biz_${destId}_${crypto.randomUUID()}`;
  setOnSave.lastWhatsAppMessageId = attemptMessageId;
  const saved = await Business.findOneAndUpdate(
    { _id: draftId },
    { $set: setOnSave },
    { upsert: true, new: true, runValidators: true, context: "query" }
  );

  return {
    applied: true,
    extractionAccepted,
    businessId: saved._id,
    onboardingState: saved.onboardingState,
    appliedHops,
    transcript,
    detectedLanguage,
    extraction: extractionAttempted
      ? {
          attempted: true,
          shapeValid: shapeResult.valid,
          shapeErrors: shapeResult.errors,
          honest: honestyResult.honest,
          failedFields: honestyResult.failedFields,
        }
      : { attempted: false },
  };
}
