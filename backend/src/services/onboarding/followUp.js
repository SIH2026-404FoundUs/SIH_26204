// Voice Onboarding — bharani-tasks.md Section 1's FOLLOWUP state.
//
// Section 1.1: FOLLOWUP "loop[s] until required fields are non-null,"
// asking "one question per null required field." This module decides
// WHICH question to ask next — pure logic only, no WhatsApp send call,
// no text-to-speech (Section 1's eventual voice-note delivery is a later,
// separate step; this function only returns text).
//
// Field order and "what counts as required" both come from
// stateMachine.js's REQUIRED_FIELDS_FOR_LIVE — the same list the LIVE
// gate itself checks (destId included, per the earlier branch that made
// destId's schema requirement conditional the same way name/type's is).
// Reusing it here, rather than a second hardcoded field list, means this
// module can never drift out of sync with what LIVE actually requires.

import { REQUIRED_FIELDS_FOR_LIVE } from "./stateMachine.js";

const DEFAULT_LANGUAGE = "en";

// destId's question is deliberately NOT "what is your destId" — an
// operator has no idea what that means, and the field's real semantics
// are "which town/area is this near," not a slug. The spoken answer
// still needs a separate resolution step (transcript text -> the
// canonical DESTINATIONS slug) that is NOT built here — this module only
// asks an honest question about location, it does not resolve the answer.
const QUESTIONS = {
  name: {
    en: "What is the name of your property or business?",
    hi: "आपकी संपत्ति या व्यवसाय का नाम क्या है?",
  },
  type: {
    en: "What kind of business is this — homestay, guesthouse, guide, driver, or cook?",
    hi: "यह किस प्रकार का व्यवसाय है — होमस्टे, गेस्टहाउस, गाइड, ड्राइवर, या कुक?",
  },
  capacity: {
    en: "How many guests can you accommodate at once?",
    hi: "आप एक बार में कितने मेहमानों को ठहरा सकते हैं?",
  },
  priceRangeINR: {
    en: "What is your price range per night, in rupees?",
    hi: "आपकी प्रति रात की कीमत सीमा रुपयों में क्या है?",
  },
  nearestLandmark: {
    en: "What is the nearest well-known landmark to your property?",
    hi: "आपकी संपत्ति के सबसे नज़दीक कौन सा प्रसिद्ध स्थान है?",
  },
  destId: {
    en: "Which town or area is your property near?",
    hi: "आपकी संपत्ति किस शहर या क्षेत्र के पास है?",
  },
};

// Fail loudly at import time, not silently at call time, if
// REQUIRED_FIELDS_FOR_LIVE and QUESTIONS ever drift apart (e.g. a future
// field added to one list but not the other).
for (const field of REQUIRED_FIELDS_FOR_LIVE) {
  if (!QUESTIONS[field]) {
    throw new Error(`followUp.js: no question text defined for required field "${field}"`);
  }
}

/**
 * Returns the question text for `field` in `language`, falling back to
 * English when `language` is missing or has no translation on file —
 * asking the wrong-language-but-real question beats returning nothing.
 */
function questionText(field, language) {
  const translations = QUESTIONS[field];
  return translations[language] ?? translations[DEFAULT_LANGUAGE];
}

/**
 * Decides the next FOLLOWUP question to ask, per Section 1.1: one
 * question, for the first null required field, in a fixed order
 * (REQUIRED_FIELDS_FOR_LIVE's own order) — not all missing fields at
 * once, and not an arbitrary order.
 *
 * @param {Object} currentFields - the draft's current extracted field
 *   values (e.g. { name, type, capacity, priceRangeINR, nearestLandmark,
 *   destId, ... }). A missing key is treated the same as an explicit null.
 * @param {string} [language] - the operator's detected language (e.g.
 *   "hi", "en"). Falls back to English if omitted or untranslated.
 * @returns {string|null} the next question to ask, or null if every
 *   required field already has a non-null value.
 */
export function getNextFollowUpQuestion(currentFields, language) {
  const fields = currentFields ?? {};

  for (const field of REQUIRED_FIELDS_FOR_LIVE) {
    const value = fields[field];
    if (value === null || value === undefined) {
      return questionText(field, language);
    }
  }

  return null;
}
