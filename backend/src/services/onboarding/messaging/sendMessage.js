// Voice Onboarding — outbound WhatsApp text messages (Section 1's FOLLOWUP
// state, and any other future step that needs to message the operator back).
//
// Endpoint shape verified against Meta's real, current Cloud API docs
// (developers.facebook.com/docs/whatsapp/cloud-api/reference/messages),
// the same way mediaDownload.js's two-step fetch was verified — not
// guessed:
//   POST https://graph.facebook.com/{version}/{WHATSAPP_PHONE_NUMBER_ID}/messages
//     Authorization: Bearer WHATSAPP_TOKEN   (same header/env var mediaDownload.js uses)
//     Content-Type: application/json
//     body: {
//       "messaging_product": "whatsapp",
//       "recipient_type": "individual",       -- required field, per Meta's docs
//       "to": "<recipient phone number>",
//       "type": "text",
//       "text": { "body": "<message text>" }
//     }
//
// sendFn is injected the same way transcribeAudio's transcribeFn is:
// defaults to the real HTTP-backed implementation below, tests supply a
// stub, so this module never makes a real network/Meta call during test
// runs.

const GRAPH_API_VERSION = "v21.0"; // same pin as mediaDownload.js, for consistency

/**
 * Real send backend. Posts a plain text message to `to` via the WhatsApp
 * Cloud API.
 *
 * @param {string} to - recipient phone number (E.164-ish, no leading "+",
 *   matching Meta's own `from` convention on inbound messages).
 * @param {string} text - the message body.
 * @returns {Promise<Object>} Meta's JSON response.
 */
async function sendViaGraphAPI(to, text) {
  const token = process.env.WHATSAPP_TOKEN;
  if (!token) {
    throw new Error("sendWhatsAppMessage: WHATSAPP_TOKEN is not set — cannot send a message without it.");
  }
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!phoneNumberId) {
    throw new Error("sendWhatsAppMessage: WHATSAPP_PHONE_NUMBER_ID is not set — cannot send a message without it.");
  }

  let response;
  try {
    response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { body: text },
      }),
    });
  } catch (networkError) {
    throw new Error(`sendWhatsAppMessage: could not reach the send-message endpoint for ${to} (${networkError.message})`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`sendWhatsAppMessage: send request to ${to} returned ${response.status}: ${body}`);
  }

  return response.json();
}

/**
 * Sends a plain text WhatsApp message. Delegates to `sendFn`, defaulting
 * to the real HTTP-backed implementation above.
 *
 * @param {string} to - recipient phone number.
 * @param {string} text - message body.
 * @param {(to: string, text: string) => Promise<Object>} [sendFn] - defaults to sendViaGraphAPI.
 * @returns {Promise<Object>}
 */
export async function sendWhatsAppMessage(to, text, sendFn = sendViaGraphAPI) {
  return sendFn(to, text);
}
