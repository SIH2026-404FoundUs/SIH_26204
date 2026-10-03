// Voice Onboarding — bharani-tasks.md Section 1.2 media download.
//
// "WhatsApp media arrives as an ID, not a file. Two calls are required,
// and the URL from the first expires in minutes."
//
//   GET https://graph.facebook.com/v21.0/{media_id}
//     with Authorization: Bearer WHATSAPP_TOKEN  -> { url, ... } (JSON)
//   GET <that url>
//     with Authorization: Bearer WHATSAPP_TOKEN  -> the actual bytes
//
// "the second call needs the auth header — easy to miss, breaks silently
// otherwise." Both calls send the same header explicitly for that reason.
//
// fetchFn is injected the same way transcribeAudio/pressureFn are:
// defaults to the real global fetch, tests supply a stub, so this module
// never makes a real network/Meta call during test runs.

const GRAPH_API_VERSION = "v21.0";

/**
 * Downloads the raw bytes of a WhatsApp media object, given its media_id
 * (from an inbound webhook message's `audio.id`/`image.id`/etc.).
 *
 * @param {string} mediaId
 * @param {typeof fetch} [fetchFn] - defaults to the global fetch.
 * @returns {Promise<Buffer>}
 */
export async function fetchWhatsAppMedia(mediaId, fetchFn = fetch) {
  const token = process.env.WHATSAPP_TOKEN;
  if (!token) {
    throw new Error("fetchWhatsAppMedia: WHATSAPP_TOKEN is not set — cannot download media without it.");
  }

  const authHeaders = { Authorization: `Bearer ${token}` };

  // Step 1: media_id -> a short-lived download URL.
  let metadataResponse;
  try {
    metadataResponse = await fetchFn(`https://graph.facebook.com/${GRAPH_API_VERSION}/${mediaId}`, {
      headers: authHeaders,
    });
  } catch (networkError) {
    throw new Error(
      `fetchWhatsAppMedia: could not reach the media metadata endpoint for ${mediaId} (${networkError.message})`
    );
  }

  if (!metadataResponse.ok) {
    const body = await metadataResponse.text().catch(() => "");
    throw new Error(
      `fetchWhatsAppMedia: media metadata request for ${mediaId} returned ${metadataResponse.status}: ${body}`
    );
  }

  const metadata = await metadataResponse.json();
  if (typeof metadata?.url !== "string" || metadata.url.length === 0) {
    throw new Error(`fetchWhatsAppMedia: media metadata response for ${mediaId} had no "url" field`);
  }

  // Step 2: the actual bytes — same auth header required here too.
  let bytesResponse;
  try {
    bytesResponse = await fetchFn(metadata.url, { headers: authHeaders });
  } catch (networkError) {
    throw new Error(
      `fetchWhatsAppMedia: could not download media bytes for ${mediaId} (${networkError.message})`
    );
  }

  if (!bytesResponse.ok) {
    const body = await bytesResponse.text().catch(() => "");
    throw new Error(
      `fetchWhatsAppMedia: media bytes download for ${mediaId} returned ${bytesResponse.status}: ${body}`
    );
  }

  const arrayBuffer = await bytesResponse.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
