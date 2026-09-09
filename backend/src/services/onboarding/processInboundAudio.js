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
import BusinessAvailability from "../../models/businessAvailability.model.js";
import { transcribeAudio } from "./transcription.js";
import { extractFields } from "./extractFields.js";
import { validateExtractionShape, checkExtractionHonesty } from "./extraction.js";
import { transitionDraft, ONBOARDING_STATES } from "./stateMachine.js";
import {
  getNextFollowUpQuestion,
  getNextMissingRequiredField,
  getInvalidDatesQuestion,
  getMissingUnitsQuestion,
  getAvailabilityConfirmedMessage,
  getPhotosFollowUpQuestion,
} from "./followUp.js";
import { parseAvailabilityDates, parseUnitCount, generateDateRange } from "./dateParser.js";
import { sendWhatsAppMessage } from "./sendMessage.js";
import { resolveDestId } from "./destinationResolver.js";
import { buildDraftConfirmationMessage, processDraftConfirmReply } from "./draftConfirm.js";

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
 * destId is optional, for both a brand-new draft and a continuing one.
 * Business.destId's schema requirement is now conditional the same way
 * name/type's is (business.model.js's requiredUnlessMidOnboarding) — it's
 * only required once onboardingState reaches LIVE (enforced by
 * stateMachine.js's REQUIRED_FIELDS_FOR_LIVE, which now includes destId
 * to keep that gate and the schema in agreement). A brand-new
 * WhatsApp-originated draft can therefore be created and progress through
 * TRANSCRIBING/EXTRACTING/etc with destId still null.
 *
 * destId RESOLUTION now exists (destinationResolver.js's resolveDestId,
 * a real-seed-data lookup, deliberately not an AI call — see that
 * module): whenever pendingField === "destId" (this message is a reply
 * to the "which town or area..." FOLLOWUP question) and no explicit
 * destId param was given, the transcript is checked against it. A
 * confident single match sets destId; anything else (no match, or a
 * genuinely ambiguous one — e.g. a real operator just saying "Hyderabad"
 * alone, which matches three real destinations) leaves it null and lets
 * the FOLLOWUP loop ask again, rather than guessing. A draft can still
 * exist and advance with destId null (extractFields() finding it in a
 * spontaneous, non-reply message is not solved by this — extraction has
 * no location-inference step), and stays blocked at the LIVE gate
 * (missing_required_fields) until something sets it.
 *
 * @param {Object} params
 * @param {Buffer} params.audioBuffer
 * @param {string} params.ownerPhone
 * @param {string} params.messageId
 * @param {string} [params.destId] - optional; a brand-new draft can now be
 *   created with destId left null (see above).
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
 *   when extractedFields was omitted (real-extraction case only). That
 *   call also receives a `pendingField` context argument, computed
 *   internally (not a param on this function) from the existing draft's
 *   pre-message fields whenever this message is for an already-progressed
 *   draft — see the inline comment above `pendingField`'s declaration.
 * @param {Function} [params.sendMessageFn] - injectable, passed through to
 *   sendWhatsAppMessage() for the FOLLOWUP question sent after a
 *   successful attempt, if required fields are still missing. Defaults to
 *   a real send (same convention as transcribeFn/extractFn) — callers
 *   that must never risk a real WhatsApp send by default (e.g.
 *   onboarding.controller.js's fallback endpoint) are responsible for
 *   supplying their own safe default; this function does not decide that
 *   for them.
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
  sendMessageFn,
}) {
  const existing = await Business.findOne({ ownerPhone });

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

  // Bootstrapping a brand-new draft (or one not yet at TRANSCRIBING) is a
  // genuinely different case from processing a NEW message for a draft
  // that has already progressed past TRANSCRIBING (e.g. a real reply to a
  // FOLLOWUP question, sent after the draft already reached EXTRACTING on
  // an earlier message). walkStates(..., "TRANSCRIBING", ...) targets a
  // FIXED ceiling — once currentState is already at or past that ceiling,
  // calling it again always fails with already_past_target, silently
  // dropping every message after the first one a draft ever receives.
  // Confirmed as a real bug via a real test before this fix, not assumed.
  const TRANSCRIBING_INDEX = ONBOARDING_STATES.indexOf("TRANSCRIBING");
  const LIVE_INDEX = ONBOARDING_STATES.length - 1;
  const currentIndex = currentState === null ? -1 : ONBOARDING_STATES.indexOf(currentState);

  let resultState;
  let appliedHops;
  // The REQUIRED_FIELDS_FOR_LIVE field name a FOLLOWUP question was just
  // asked about, if this message is a reply to one — determined from the
  // EXISTING draft's PRE-message field state (the same presence check
  // that decided what to ask last time; not a separately stored "last
  // question" pointer). Passed to extractFields() below so a terse,
  // context-dependent reply ("Six") can be correctly interpreted instead
  // of defaulting to null, per the extraction prompt's own "return null
  // if in doubt" discipline. Deliberately left null for a bootstrap
  // message (see the `if` branch below) — a spontaneous first message
  // has no pending question to be a reply to.
  let pendingField = null;

  if (currentIndex < TRANSCRIBING_INDEX) {
    // Brand-new draft, or one still short of TRANSCRIBING — walk it
    // forward hop by hop, exactly as before this fix.
    const preCheck = walkStates(currentState, "TRANSCRIBING", attemptMessageId);
    if (!preCheck.ok) {
      return {
        applied: false,
        reason: preCheck.reason,
        businessId: existing?._id ?? null,
        onboardingState: currentState,
      };
    }
    resultState = preCheck.state;
    appliedHops = preCheck.appliedHops;
  } else if (currentIndex >= LIVE_INDEX) {
    // LIVE is terminal — this pipeline does not reprocess a live business.
    return {
      applied: false,
      reason: "already_past_target",
      businessId: existing?._id ?? null,
      onboardingState: currentState,
    };
  } else {
    // Draft already exists at or past TRANSCRIBING (but not LIVE) — this
    // is a genuinely new message for an already-progressed draft, not a
    // bootstrap. Do not force another transition; process this message's
    // content against the draft's CURRENT state as-is.
    resultState = currentState;
    appliedHops = [];
    // This is almost certainly a reply to whatever FOLLOWUP question was
    // sent after the last successful message — recomputed here from
    // `existing`'s pre-message fields, not tracked as separate state. If
    // nothing was actually missing last time, no question was sent, and
    // this correctly stays null too (same self-correcting property
    // getNextFollowUpQuestion itself relies on).
    pendingField = getNextMissingRequiredField(existing);
  }

  const { transcript, detectedLanguage } = await transcribeAudio(audioBuffer, transcribeFn);

  // AWAITING_DATES — Section 1.1: provider sends their availability dates and units.
  // Parses dates and units, creates BusinessAvailability documents, transitions
  // to DRAFT_CONFIRM, and sends confirmation or follow-up clarification message.
  if (currentState === "AWAITING_DATES") {
    const datesParsed = parseAvailabilityDates(transcript);
    const unitsParsed = parseUnitCount(transcript);

    if (!datesParsed) {
      const question = getInvalidDatesQuestion(detectedLanguage);
      try {
        await sendWhatsAppMessage(ownerPhone, question, sendMessageFn);
      } catch (err) {
        console.error(`processInboundAudio: failed to send invalid dates question: ${err.message}`);
      }
      return {
        applied: false,
        reason: "invalid_dates",
        businessId: existing._id,
        onboardingState: currentState,
        transcript,
        detectedLanguage,
      };
    }

    if (unitsParsed === null) {
      const question = getMissingUnitsQuestion(detectedLanguage);
      try {
        await sendWhatsAppMessage(ownerPhone, question, sendMessageFn);
      } catch (err) {
        console.error(`processInboundAudio: failed to send missing units question: ${err.message}`);
      }
      return {
        applied: false,
        reason: "missing_units",
        businessId: existing._id,
        onboardingState: currentState,
        transcript,
        detectedLanguage,
      };
    }

    // Both dates and units successfully parsed — create/update BusinessAvailability records
    const dateList = generateDateRange(datesParsed.startDate, datesParsed.endDate);
    const resourceType = "room";
    const pricePerNight = existing.priceRangeINR?.min ?? 0;

    for (const d of dateList) {
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(d.getUTCDate()).padStart(2, "0");
      const dateStr = `${yyyy}${mm}${dd}`;
      const availId = `avail_${existing._id}_${dateStr}`;

      await BusinessAvailability.findOneAndUpdate(
        { businessId: existing._id, date: d, resourceType },
        {
          $set: {
            units: { total: unitsParsed, available: unitsParsed },
            pricePerNight,
            isOpen: true,
            source: "business_declared",
            updatedAt: new Date(),
          },
          $setOnInsert: {
            _id: availId,
          },
        },
        { upsert: true, new: true, runValidators: true }
      );
    }

    // Transition state: AWAITING_DATES -> DRAFT_CONFIRM
    const transition = transitionDraft(existing, "DRAFT_CONFIRM", attemptMessageId);
    const nextState = transition.applied ? transition.state : "DRAFT_CONFIRM";

    const saved = await Business.findOneAndUpdate(
      { _id: existing._id },
      {
        $set: {
          onboardingState: nextState,
          lastWhatsAppMessageId: attemptMessageId,
        },
      },
      { new: true, runValidators: true, context: "query" }
    );

    // Send draft confirmation listing summary message
    try {
      const summaryMsg = await buildDraftConfirmationMessage(saved._id, detectedLanguage, { includeIntro: true });
      await sendWhatsAppMessage(ownerPhone, summaryMsg, sendMessageFn);
    } catch (err) {
      console.error(`processInboundAudio: failed to send draft confirmation message: ${err.message}`);
    }

    return {
      applied: true,
      businessId: saved._id,
      onboardingState: saved.onboardingState,
      appliedHops: ["DRAFT_CONFIRM"],
      transcript,
      detectedLanguage,
      availability: {
        startDate: datesParsed.startDate,
        endDate: datesParsed.endDate,
        recordCount: dateList.length,
        units: unitsParsed,
        resourceType,
      },
    };
  }
 
  // DRAFT_CONFIRM — Section 1.1: provider confirms or corrects their listing.
  if (currentState === "DRAFT_CONFIRM") {
    const replyResult = await processDraftConfirmReply({
      ownerPhone,
      text: transcript,
      messageId: attemptMessageId,
      sendMessageFn,
      extractFn,
      language: detectedLanguage,
    });
    return {
      ...replyResult,
      transcript,
      detectedLanguage,
      appliedHops: replyResult.onboardingState === "LIVE" ? ["LIVE"] : [],
    };
  }

  // extractedFields omitted entirely (undefined) is the real WhatsApp
  // case: no placeholder was given, so actually call the real extraction
  // service rather than skipping. Explicit null stays an intentional
  // "don't attempt" opt-out, still supported. See the param doc above for
  // the full three-way contract.
  let effectiveExtractedFields = extractedFields;
  if (extractedFields === undefined) {
    effectiveExtractedFields = await extractFields(transcript, detectedLanguage, pendingField, extractFn);
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
    onboardingState: resultState, // TRANSCRIBING (or whatever it already was), unless the EXTRACTING merge below applies
    ...extraFields,
  };
  if (destId) {
    setOnSave.destId = destId;
  } else if (pendingField === "destId") {
    // This message is (almost certainly) the operator's reply to the
    // "which town or area is your property near?" FOLLOWUP question — a
    // lookup problem against real seed data, not an extraction problem,
    // so this runs independently of the AI extraction pipeline above
    // (same reasoning as the explicit destId param merging
    // unconditionally, just above). No AI call, no guessing: only sets
    // destId when resolveDestId() found exactly one confident match;
    // stays null (draft unchanged, same question asked again next time)
    // otherwise — see destinationResolver.js for the full matching rules.
    const resolvedDestId = resolveDestId(transcript);
    if (resolvedDestId) {
      setOnSave.destId = resolvedDestId;
    }
  }

  // Only advance past TRANSCRIBING, and only persist the extracted
  // fields, when the extraction was both well-formed and honest. A failed
  // check does not silently drop the rejection — it's reported in full in
  // the return value — but it also must not advance the draft.
  if (extractionAccepted) {
    // A draft already sitting at EXTRACTING (a second-or-later message,
    // e.g. a real reply to a FOLLOWUP question) has the same
    // already-past-target problem one level deeper: transitionDraft(...,
    // "EXTRACTING", ...) would reject EXTRACTING -> EXTRACTING as
    // invalid_transition, since EXTRACTING has no self-loop in
    // stateMachine.js (unlike FOLLOWUP) — silently dropping this
    // message's newly-accepted fields the same way the outer
    // already_past_target bug did. No transition is needed when already
    // there; just merge.
    let extractionApplied;
    if (resultState === "EXTRACTING") {
      extractionApplied = true;
    } else {
      const extractStep = transitionDraft(
        { onboardingState: resultState, lastWhatsAppMessageId: null },
        "EXTRACTING",
        `${attemptMessageId}::step_extract`
      );
      extractionApplied = extractStep.applied;
      if (extractionApplied) {
        appliedHops = [...appliedHops, "EXTRACTING"];
      }
    }

    if (extractionApplied) {
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
  // enum/shape checks run — but name/type/destId are conditionally
  // required only once onboardingState reaches LIVE; see
  // business.model.js). destId can be undefined here for a genuinely new
  // draft now — falls back to a placeholder segment so the generated _id
  // never embeds the literal string "undefined".
  const draftId = existing ? existing._id : `biz_${destId || "unresolved-dest"}_${crypto.randomUUID()}`;
  setOnSave.lastWhatsAppMessageId = attemptMessageId;
  let saved = await Business.findOneAndUpdate(
    { _id: draftId },
    { $set: setOnSave },
    { upsert: true, new: true, runValidators: true, context: "query" }
  );

  // Section 1.1's FOLLOWUP question, sent after every processed message
  // (regardless of whether this message's own extraction was accepted —
  // required fields may already be missing independent of that), based on
  // the draft's actual current state, not just what this message
  // contributed. A failed send must not undo an already-successful save:
  // the extraction/state advancement above already happened and is
  // correct regardless of whether the operator ever receives this question.
  try {
    const nextQuestion = getNextFollowUpQuestion(saved, detectedLanguage);
    if (nextQuestion) {
      await sendWhatsAppMessage(ownerPhone, nextQuestion, sendMessageFn);
    } else if (saved.onboardingState === "EXTRACTING") {
      // All 6 required fields are present — transition from EXTRACTING to AWAITING_PHOTOS
      const photoTransition = transitionDraft(
        saved,
        "AWAITING_PHOTOS",
        `${attemptMessageId}::step_photos`
      );
      const nextState = photoTransition.applied ? photoTransition.state : "AWAITING_PHOTOS";
      saved = await Business.findOneAndUpdate(
        { _id: saved._id },
        { $set: { onboardingState: nextState } },
        { new: true, runValidators: true, context: "query" }
      );
      if (photoTransition.applied) {
        appliedHops = [...appliedHops, "AWAITING_PHOTOS"];
      }

      const photoPrompt = getPhotosFollowUpQuestion(detectedLanguage);
      await sendWhatsAppMessage(ownerPhone, photoPrompt, sendMessageFn);
    }
  } catch (sendError) {
    console.error(
      `processInboundAudio: failed to send follow-up question to ownerPhone for business ${saved._id}: ${sendError.message}`
    );
  }

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
