// Voice Onboarding — bharani-tasks.md Section 1.2 transcription interface.
//
// Thin boundary only: no WhatsApp media-download logic here (the two-step
// auth-header fetch is separate and comes next), and no real faster-whisper
// wiring yet. transcribeAudio() takes the real transcription backend as an
// injected function — the same dependency-injection pattern eligibility.js
// uses for pressureFn: production code passes a real transcribeFn; tests
// supply a stub, so this module never depends on faster-whisper actually
// being installed/running to be exercised.

/**
 * Placeholder for the real transcription backend. Throws clearly rather
 * than silently returning nothing or garbage, so a caller that forgets to
 * wire up the real implementation fails loudly instead of shipping a
 * broken onboarding flow.
 *
 * Real contract this must satisfy once implemented (faster-whisper
 * distil-large-v3 per Section 1.2 — do not use large-v3 on CPU):
 *   (audioBuffer) => Promise<{ transcript: string, detectedLanguage: string }>
 * detectedLanguage matters beyond transcription itself: Section 1.3's
 * extraction/follow-up flow needs to know which language to ask the
 * operator follow-up questions in.
 *
 * @param {*} _audioBuffer
 * @returns {Promise<never>}
 */
async function notImplementedTranscribeFn(_audioBuffer) {
  throw new Error(
    "transcribeAudio: no transcribeFn provided and the default backend is not implemented yet — " +
      "wire up faster-whisper here (Section 1.2: distil-large-v3, not large-v3 on CPU)."
  );
}

/**
 * Thin transcription interface boundary. Delegates to `transcribeFn`, the
 * real transcription backend, defaulting to a stub that throws a clear,
 * actionable error if none is supplied — so an unwired call fails loudly
 * rather than silently doing nothing.
 *
 * @param {Buffer} audioBuffer - raw audio bytes.
 * @param {(audioBuffer: Buffer) => Promise<{transcript: string, detectedLanguage: string}>} [transcribeFn]
 *   Defaults to the not-implemented-yet stub above.
 * @returns {Promise<{ transcript: string, detectedLanguage: string }>}
 */
export async function transcribeAudio(audioBuffer, transcribeFn = notImplementedTranscribeFn) {
  return transcribeFn(audioBuffer);
}
