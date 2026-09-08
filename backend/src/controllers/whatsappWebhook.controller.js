// WhatsApp Cloud API webhook — bharani-tasks.md Section 1.1/1.2.
//
// This pass only: verify correctly, receive correctly, log correctly.
// NOT wired into the state machine yet — that's the next step, once a
// real payload has been seen on stage/in testing and its shape confirmed
// against what's assumed here. No fixture/sample payload exists anywhere
// in this repo (checked before writing this — no __fixtures__ directory,
// no webhook-related file anywhere prior to this).
//
// The POST body shape below is based on Meta's publicly documented
// WhatsApp Cloud API webhook payload format, not a real captured sample:
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
// `messages[].audio.id` is the media_id Section 1.2's two-step fetch needs
// (GET .../v21.0/{media_id} then the authenticated URL it returns) — only
// the id is extracted here, never the actual audio bytes; that fetch isn't
// built yet. A webhook delivery can also carry `value.statuses` (delivery/
// read receipts) instead of `value.messages` — those are ignored here,
// not an error case.

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
 * POST /api/webhook/whatsapp — inbound message delivery.
 * Meta requires a fast 200 regardless of processing outcome (it retries
 * aggressively otherwise) — so the full raw payload is logged for later
 * inspection, sender/type/media-id are extracted and logged per message,
 * and the response is always 200, even if logging/parsing itself throws.
 */
export function receiveWebhook(req, res) {
  console.log("WhatsApp webhook payload:", JSON.stringify(req.body, null, 2));

  try {
    const entries = Array.isArray(req.body?.entry) ? req.body.entry : [];
    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];
      for (const change of changes) {
        const messages = Array.isArray(change?.value?.messages) ? change.value.messages : [];
        for (const message of messages) {
          const from = message?.from ?? null;
          const type = message?.type ?? null;
          const messageId = message?.id ?? null;

          if (type === "audio") {
            const mediaId = message?.audio?.id ?? null;
            console.log("Inbound WhatsApp audio message:", { from, messageId, mediaId });
          } else if (type === "text") {
            const text = message?.text?.body ?? null;
            console.log("Inbound WhatsApp text message:", { from, messageId, text });
          } else {
            console.log("Inbound WhatsApp message of unhandled type:", { from, messageId, type });
          }
        }
      }
    }
  } catch (error) {
    // Never let our own logging/parsing failure turn into a missed 200 —
    // that would trigger a Meta retry storm on top of whatever broke.
    console.error("Error while logging WhatsApp webhook payload:", error.message);
  }

  return res.sendStatus(200);
}
