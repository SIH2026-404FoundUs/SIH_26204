// Voice Onboarding — bharani-tasks.md Section 1.2 transcription interface.
//
// Thin boundary: no WhatsApp media-download logic here (the two-step
// auth-header fetch is separate). transcribeAudio() takes the real
// transcription backend as an injected function — the same
// dependency-injection pattern eligibility.js uses for pressureFn:
// production code lets the default run; tests supply a stub, so this
// module's own tests never depend on the real service being reachable.
//
// The real backend (Section 1.2: faster-whisper distil-large-v3, not
// large-v3 on CPU) is Python-only — faster-whisper is built on CTranslate2
// with no genuine Node binding, so it runs as a small persistent FastAPI
// service in ai-service/app/onboarding/transcribe.py (loading the model
// once, not per-request) rather than a per-call subprocess or a pure-JS
// reimplementation. This module's default transcribeFn calls that service
// over HTTP.

const DEFAULT_TRANSCRIBE_SERVICE_URL = "http://localhost:8000/onboarding/transcribe";

/**
 * Real transcription backend. Calls the local faster-whisper FastAPI
 * service (ai-service/app/onboarding/transcribe.py) over HTTP, posting the
 * raw audio bytes as multipart/form-data under the field name "audio" (the
 * name that endpoint's `UploadFile = File(...)` parameter expects) and
 * mapping its JSON response onto this module's contract.
 *
 * Configurable via TRANSCRIBE_SERVICE_URL (read fresh on every call, not
 * cached at import time) for pointing at a non-default host/port.
 *
 * @param {Buffer} audioBuffer
 * @returns {Promise<{ transcript: string, detectedLanguage: string }>}
 */
async function callWhisperService(audioBuffer) {
  const url = process.env.TRANSCRIBE_SERVICE_URL || DEFAULT_TRANSCRIBE_SERVICE_URL;

  const form = new FormData();
  form.append("audio", new Blob([audioBuffer]), "audio");

  let response;
  try {
    response = await fetch(url, { method: "POST", body: form });
  } catch (networkError) {
    throw new Error(
      `transcribeAudio: could not reach the transcription service at ${url} — is ai-service running ` +
        `(uvicorn app.main:app)? (${networkError.message})`
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`transcribeAudio: transcription service returned ${response.status}: ${body}`);
  }

  const data = await response.json();
  if (typeof data?.transcript !== "string" || typeof data?.detectedLanguage !== "string") {
    throw new Error("transcribeAudio: transcription service returned an unexpected shape");
  }

  return { transcript: data.transcript, detectedLanguage: data.detectedLanguage };
}

/**
 * Thin transcription interface boundary. Delegates to `transcribeFn`,
 * defaulting to the real HTTP-backed implementation above.
 *
 * @param {Buffer} audioBuffer - raw audio bytes.
 * @param {(audioBuffer: Buffer) => Promise<{transcript: string, detectedLanguage: string}>} [transcribeFn]
 *   Defaults to callWhisperService.
 * @returns {Promise<{ transcript: string, detectedLanguage: string }>}
 */
export async function transcribeAudio(audioBuffer, transcribeFn = callWhisperService) {
  return transcribeFn(audioBuffer);
}
