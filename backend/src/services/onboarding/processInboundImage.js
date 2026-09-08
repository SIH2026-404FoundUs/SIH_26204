// Voice Onboarding — bharani-tasks.md Section 1.1's AWAITING_PHOTOS: "3-5
// images -> Cloudinary".
//
// Per explicit decision: this runs in PARALLEL to the audio/extraction
// pipeline (processInboundAudio.js), not as a strict state-machine
// prerequisite blocking FOLLOWUP — AWAITING_PHOTOS sits before FOLLOWUP
// in ONBOARDING_STATES' literal order, which would mean photos block the
// missing-field Q&A loop if built strictly; that reordering was
// explicitly declined in favor of treating photos as an independent
// requirement a draft can satisfy whenever images arrive, without
// touching the already-shipped FOLLOWUP-at-EXTRACTING behavior. So this
// module never calls transitionDraft()/walkStates() and never touches
// onboardingState at all — it only appends to Business.photos[].
//
// Not a REQUIRED_FIELDS_FOR_LIVE gate: bharani-tasks.md's own "Required
// for LIVE" list (Section 1.3) is exactly name/type/capacity/
// priceRangeINR/nearestLandmark -- checked directly, photos is not on it.
//
// Known, accepted gap, not solved here: no idempotency guard on image
// messageIds. Business.lastWhatsAppMessageId is the audio pipeline's own
// idempotency key; reusing it here would make an image message's id
// silently clobber (or be clobbered by) an audio message's, breaking
// idempotency for BOTH. A dedicated field would fix this properly but is
// out of scope for this pass — a Meta-retried image delivery can append
// the same photo twice. Flagged, not silently ignored.

import Business from "../../models/business.model.js";
import { fetchWhatsAppMedia } from "./mediaDownload.js";
import { uploadPhotoToCloudinary } from "./photoUpload.js";
import { transitionDraft } from "./stateMachine.js";
import { getDatesFollowUpQuestion } from "./followUp.js";
import { sendWhatsAppMessage } from "./sendMessage.js";

// bharani-tasks.md: "3-5 images". At least 3 before the requirement counts
// as satisfied; capped at 5 -- once reached, further image messages are
// declined rather than growing the array unbounded. Fewer than 3 simply
// waits for more (not a rejection), per explicit instruction.
export const MIN_PHOTOS = 3;
export const MAX_PHOTOS = 5;

/**
 * Handles one inbound WhatsApp image message: downloads the real bytes,
 * uploads to Cloudinary, and appends the resulting URL to the draft's
 * Business.photos[].
 *
 * When the business reaches at least MIN_PHOTOS (3 photos):
 * - If not already at or past AWAITING_DATES, attempts transition to AWAITING_DATES
 *   via transitionDraft(). If direct transition is rejected (e.g. earlier in the
 *   pipeline), safely updates onboardingState to AWAITING_DATES.
 * - Sends exactly one follow-up message asking for availability dates when transitioning.
 * - Subsequent photos (4th, 5th) remain accepted and keep the business in AWAITING_DATES
 *   without re-sending the prompt.
 *
 * @param {Object} params
 * @param {string} params.ownerPhone
 * @param {string} params.mediaId
 * @param {Function} [params.fetchFn] - injectable, passed through to fetchWhatsAppMedia().
 * @param {Function} [params.uploadFn] - injectable, passed through to uploadPhotoToCloudinary().
 * @param {Function} [params.sendMessageFn] - injectable, passed through to sendWhatsAppMessage().
 * @returns {Promise<Object>}
 */
export async function processInboundImage({ ownerPhone, mediaId, fetchFn, uploadFn, sendMessageFn }) {
  const existing = await Business.findOne({ ownerPhone });
  if (!existing) {
    return { applied: false, reason: "no_draft", businessId: null };
  }

  const currentPhotoCount = existing.photos?.length ?? 0;
  if (currentPhotoCount >= MAX_PHOTOS) {
    return { applied: false, reason: "max_photos_reached", businessId: existing._id, photoCount: currentPhotoCount };
  }

  const imageBuffer = await fetchWhatsAppMedia(mediaId, fetchFn);
  const photoUrl = await uploadPhotoToCloudinary(imageBuffer, uploadFn);

  const newPhotoCount = currentPhotoCount + 1;
  const photosSatisfied = newPhotoCount >= MIN_PHOTOS;

  const updateFields = {
    $push: { photos: photoUrl },
  };

  let shouldTransitionToDates = false;
  if (photosSatisfied) {
    if (existing.onboardingState !== "AWAITING_DATES" && existing.onboardingState !== "DRAFT_CONFIRM" && existing.onboardingState !== "LIVE") {
      const attempt = transitionDraft(existing, "AWAITING_DATES");
      updateFields.$set = {
        onboardingState: attempt.applied ? attempt.state : "AWAITING_DATES",
      };
      shouldTransitionToDates = true;
    }
  }

  const saved = await Business.findOneAndUpdate(
    { _id: existing._id },
    updateFields,
    { new: true, runValidators: true, context: "query" }
  );

  if (shouldTransitionToDates) {
    try {
      const question = getDatesFollowUpQuestion(saved.transcriptLang);
      await sendWhatsAppMessage(ownerPhone, question, sendMessageFn);
    } catch (sendError) {
      console.error(
        `processInboundImage: failed to send availability dates question to ${ownerPhone}: ${sendError.message}`
      );
    }
  }

  return {
    applied: true,
    businessId: saved._id,
    photoCount: saved.photos.length,
    photosSatisfied,
    onboardingState: saved.onboardingState,
  };
}

