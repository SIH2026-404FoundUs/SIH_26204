// Voice Onboarding — bharani-tasks.md Section 1.3 real extraction call.
//
// Thin boundary, mirroring transcription.js's shape exactly: no prompt
// design or Gemini-response handling lives here, that's
// ai-service/app/main.py's POST /onboarding/extract. extractFields() takes
// the real extraction backend as an injected function — the same
// dependency-injection pattern eligibility.js uses for pressureFn and
// transcription.js uses for transcribeFn: production code lets the
// default run; tests supply a stub, so this module's own tests never
// depend on a real Gemini call.
//
// Deliberately does NOT run validateExtractionShape/checkExtractionHonesty
// on the result — those stay in extraction.js and are applied by the
// caller (processInboundAudio.js) to whatever comes back, exactly as they
// already are today. This module's only job is "get the raw extraction
// object over the wire," matching transcribeAudio's equivalent scope.

const DEFAULT_EXTRACT_SERVICE_URL = "http://localhost:8000/onboarding/extract";

/**
 * Real extraction backend. Calls the ai-service FastAPI endpoint
 * (ai-service/app/main.py's POST /onboarding/extract) with the transcript
 * (+ detected language) as JSON, returning whatever JSON object it sends
 * back untouched — shape/honesty validation is the caller's job, not this
 * module's.
 *
 * Configurable via EXTRACT_SERVICE_URL (read fresh on every call, not
 * cached at import time) for pointing at a non-default host/port.
 *
 * @param {string} transcript
 * @param {string} [language]
 * @returns {Promise<Object>} whatever the service returned, unvalidated.
 */
async function callExtractionService(transcript, language) {
  const url = process.env.EXTRACT_SERVICE_URL || DEFAULT_EXTRACT_SERVICE_URL;

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript, language }),
    });
  } catch (networkError) {
    throw new Error(
      `extractFields: could not reach the extraction service at ${url} — is ai-service running ` +
        `(uvicorn app.main:app)? (${networkError.message})`
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`extractFields: extraction service returned ${response.status}: ${body}`);
  }

  return response.json();
}

/**
 * Thin extraction interface boundary. Delegates to `extractFn`, defaulting
 * to the real HTTP-backed implementation above.
 *
 * @param {string} transcript
 * @param {string} [language]
 * @param {(transcript: string, language?: string) => Promise<Object>} [extractFn]
 *   Defaults to callExtractionService.
 * @returns {Promise<Object>} the raw extraction object, unvalidated —
 *   pass it through validateExtractionShape/checkExtractionHonesty
 *   (extraction.js) before trusting it.
 */
export async function extractFields(transcript, language, extractFn = callExtractionService) {
  return extractFn(transcript, language);
}
