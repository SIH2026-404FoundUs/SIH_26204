// WhatsApp Cloud API webhook — bharani-tasks.md Section 1.1/1.2/1.6.
//
// No fixture/sample payload existed anywhere in this repo when the GET/POST
// skeleton was first built; a real audio payload has since been confirmed
// against a live WhatsApp test-number send, matching the shape assumed
// below (based on Meta's publicly documented WhatsApp Cloud API webhook
// format, not a captured sample at the time it was written):
//   https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks
//   https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples
//
// Documented shape for an inbound message notification:
// {
//   "object": "whatsapp_business_account",
//   "entry": [{
//     "id": "<WHATSAPP_BUSINESS_ACCOUNT_ID>",
//     "changes": [{
//       "field": "messages",
//       "value": {
//         "messaging_product": "whatsapp",
//         "metadata": { "display_phone_number": "...", "phone_number_id": "..." },
//         "contacts": [{ "profile": { "name": "..." }, "wa_id": "<SENDER_WA_ID>" }],
//         "messages": [{
//           "from": "<SENDER_PHONE_NUMBER>",   // no leading "+"
//           "id": "<MESSAGE_ID>",              // Meta's wamid — this IS lastWhatsAppMessageId
//           "timestamp": "<UNIX_TIMESTAMP>",
//           "type": "text" | "audio" | ...,
//           "text": { "body": "<MESSAGE_TEXT>" },        // when type === "text"
//           "audio": { "id": "<MEDIA_ID>", "mime_type": "..." }  // when type === "audio"
//         }]
//       }
//     }]
//   }]
// }
//
// `entry`/`changes`/`messages` are all arrays — Meta can batch more than
// one in a single POST, so all three are iterated, not just indexed at [0].
// A webhook delivery can also carry `value.statuses` (delivery/read
// receipts) instead of `value.messages` — those are ignored here, not an
// error case (no `value.messages` key on them at all, so the per-message
// loop below simply never runs for them).
//
// This is the point where the real WhatsApp path and the internal
// fallback endpoint (Section 1.6) converge into one shared pipeline, per
// "the exact same pipeline downstream of the webhook": an inbound audio
// message calls fetchWhatsAppMedia() for the real bytes, then hands them
// to the SAME services/onboarding/processInboundAudio.js the internal
// endpoint uses — no second implementation of transcribe -> validate ->
// honesty-check -> transitionDraft -> persist lives here.
//
// Meta requires a fast 200 regardless of processing outcome (it retries
// aggressively otherwise), and transcription alone can take up to ~90s on
// CPU per Section 1.2's own warning — so the response is sent immediately,
// before any of that work starts, not after awaiting it. The actual
// processing runs in the background; failures are logged, never surfaced
// back to Meta (the response has already gone out by then).

import { fetchWhatsAppMedia } from "../services/onboarding/mediaDownload.js";
import { processInboundAudio, isDuplicateMessage } from "../services/onboarding/processInboundAudio.js";

/**
 * GET /api/webhook/whatsapp — Meta's one-time verification handshake.
 * Meta calls this when the webhook URL is registered/re-verified in the
 * developer dashboard, sending hub.mode, hub.verify_token, hub.challenge
 * as query params. Echo hub.challenge back as plain text with 200 only if
 * hub.mode is "subscribe" and hub.verify_token matches our configured
 * secret; 403 otherwise — including when the secret itself isn't
 * configured, so an unset env var can never accidentally match an
 * unset/missing token from the caller.
 */
export function verifyWebhook(req, res) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (expectedToken && mode === "subscribe" && token === expectedToken) {
    return res.status(200).type("text/plain").send(challenge);
  }

  return res.sendStatus(403);
}

/**
 * Processes one inbound message from the webhook payload. Only "audio" is
 * wired into the real pipeline right now — "text" (e.g. the consent reply
 * that would drive AWAITING_CONSENT) and anything else are just logged,
 * per this task's scope.
 *
 * @param {Object} message
 * @param {Object} deps
 * @param {Function} [deps.fetchFn] - injectable, passed through to fetchWhatsAppMedia().
 * @param {Function} [deps.transcribeFn] - injectable, passed through to transcribeAudio().
 */
async function processWebhookMessage(message, { fetchFn, transcribeFn } = {}) {
  const from = message?.from ?? null;
  const type = message?.type ?? null;
  const messageId = message?.id ?? null;

  if (type === "audio") {
    const mediaId = message?.audio?.id ?? null;
    console.log("Inbound WhatsApp audio message:", { from, messageId, mediaId });

    if (!from || !messageId || !mediaId) {
      console.error("Inbound WhatsApp audio message missing from/id/audio.id — cannot process:", {
        from,
        messageId,
        mediaId,
      });
      return;
    }

    // Meta retries webhook deliveries aggressively (see module docstring)
    // — check for a replay BEFORE spending a media download on it, not
    // just after, so a retry costs nothing beyond one DB lookup.
    if (await isDuplicateMessage(from, messageId)) {
      console.log("WhatsApp audio message is a replay of an already-processed messageId — skipping:", {
        from,
        messageId,
      });
      return;
    }

    // KNOWN GAP, not silently defaulted: no real extraction call
    // (Qwen3/Gemini) is wired in here yet. extractedFields is passed as
    // an explicit `null` below -- not omitted -- so processInboundAudio
    // treats this as "extraction not attempted": it stops the draft at
    // TRANSCRIBING and writes none of the extraction fields, rather than
    // risking clobbering any real values a prior extraction may have set.
    // Once a real extraction call exists for this path, replace `null`
    // with its actual result.
    const audioBuffer = await fetchWhatsAppMedia(mediaId, fetchFn);
    const result = await processInboundAudio({
      audioBuffer,
      ownerPhone: from,
      messageId,
      extractedFields: null,
      transcribeFn,
    });
    console.log("WhatsApp audio message processed:", result);
  } else if (type === "text") {
    const text = message?.text?.body ?? null;
    console.log("Inbound WhatsApp text message:", { from, messageId, text });
  } else {
    console.log("Inbound WhatsApp message of unhandled type:", { from, messageId, type });
  }
}

async function processWebhookPayload(body, deps) {
  const entries = Array.isArray(body?.entry) ? body.entry : [];
  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      const messages = Array.isArray(change?.value?.messages) ? change.value.messages : [];
      for (const message of messages) {
        await processWebhookMessage(message, deps);
      }
    }
  }
}

/**
 * Builds the POST /api/webhook/whatsapp handler. `fetchFn`/`transcribeFn`
 * are injectable for tests, exactly like eligibility.js's pressureFn —
 * production callers omit both and get the real network calls.
 *
 * @param {Object} [deps]
 * @param {Function} [deps.fetchFn]
 * @param {Function} [deps.transcribeFn]
 */
export function createReceiveWebhookHandler({ fetchFn, transcribeFn } = {}) {
  function handleReceiveWebhook(req, res) {
    console.log("WhatsApp webhook payload:", JSON.stringify(req.body, null, 2));

    // Fast 200 first — see module docstring for why this must not wait on
    // the actual processing below.
    res.sendStatus(200);

    const backgroundWork = processWebhookPayload(req.body, { fetchFn, transcribeFn }).catch((error) => {
      // The response is already sent; nothing to return this to. Log only.
      console.error("Error processing WhatsApp webhook payload:", error.message);
    });

    // Exposed purely for tests to await ("...through to a persisted state
    // change" isn't observable otherwise, since this is intentionally
    // fire-and-forget in production). Never read in production code.
    handleReceiveWebhook.pendingWork.push(backgroundWork);
  }

  handleReceiveWebhook.pendingWork = [];
  return handleReceiveWebhook;
}

// Default-configured handler for production wiring (index.js), matching
// how every other route in this codebase is mounted directly.
export const receiveWebhook = createReceiveWebhookHandler();
