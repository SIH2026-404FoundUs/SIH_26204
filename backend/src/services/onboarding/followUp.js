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
// isRequiredFieldPresent is reused for the same reason: priceRangeINR's
// Mongoose-nested-object-defaults-to-{} quirk (confirmed for real, see
// that function's own comment in stateMachine.js) must be detected
// identically here and at the LIVE gate, not via a second, possibly
// drifting presence check.

import { REQUIRED_FIELDS_FOR_LIVE, isRequiredFieldPresent } from "./stateMachine.js";

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

export const DATES_QUESTIONS = {
  en: "Please tell us which dates your property will be open and available for guests.",
  hi: "कृपया बताएं कि आपकी संपत्ति किन तिथियों पर मेहमानों के लिए खुली और उपलब्ध रहेगी।",
};

export const INVALID_DATES_QUESTIONS = {
  en: "We couldn't clearly understand your availability dates. Please tell us your open dates (for example, 'October 10 to October 20').",
  hi: "हम आपकी उपलब्धता तिथियों को स्पष्ट रूप से समझ नहीं पाए। कृपया अपनी खुली तिथियां बताएं (उदाहरण के लिए, '10 अक्टूबर से 20 अक्टूबर')।",
};

export const MISSING_UNITS_QUESTIONS = {
  en: "Please tell us how many rooms or units are available for those dates.",
  hi: "कृपया बताएं कि उन तिथियों के लिए कितने कमरे या इकाइयां उपलब्ध हैं।",
};

export const AVAILABILITY_CONFIRMED_MESSAGES = {
  en: "Your availability dates and units have been recorded. Your listing is now ready for the confirmation step.",
  hi: "आपकी उपलब्धता तिथियां और इकाइयां दर्ज कर ली गई हैं। आपकी लिस्टिंग अब पुष्टिकरण चरण के लिए तैयार है।",
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
 * The name of the first REQUIRED_FIELDS_FOR_LIVE field that is not yet
 * genuinely present on `currentFields`, in REQUIRED_FIELDS_FOR_LIVE's own
 * order — or null if every required field is already present. This is
 * the field getNextFollowUpQuestion() would ask about next; exported
 * separately (not just as question text) so a caller can also use the
 * raw field name as context elsewhere — e.g. processInboundAudio.js
 * passing it to extractFields() so the AI extraction prompt knows a
 * reply is likely answering this specific field.
 *
 * @param {Object} currentFields
 * @returns {string|null}
 */
export function getNextMissingRequiredField(currentFields) {
  const fields = currentFields ?? {};

  for (const field of REQUIRED_FIELDS_FOR_LIVE) {
    if (!isRequiredFieldPresent(field, fields[field])) {
      return field;
    }
  }

  return null;
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
 *   required field is already genuinely present.
 */
export function getNextFollowUpQuestion(currentFields, language) {
  const field = getNextMissingRequiredField(currentFields);
  return field ? questionText(field, language) : null;
}

/**
 * Returns the follow-up prompt for AWAITING_DATES in the operator's language,
 * falling back to English.
 *
 * @param {string} [language]
 * @returns {string}
 */
export function getDatesFollowUpQuestion(language) {
  return DATES_QUESTIONS[language] ?? DATES_QUESTIONS[DEFAULT_LANGUAGE];
}

/**
 * Returns the clarification prompt when dates are invalid or ambiguous.
 *
 * @param {string} [language]
 * @returns {string}
 */
export function getInvalidDatesQuestion(language) {
  return INVALID_DATES_QUESTIONS[language] ?? INVALID_DATES_QUESTIONS[DEFAULT_LANGUAGE];
}

/**
 * Returns the clarification prompt when unit count is missing or ambiguous.
 *
 * @param {string} [language]
 * @returns {string}
 */
export function getMissingUnitsQuestion(language) {
  return MISSING_UNITS_QUESTIONS[language] ?? MISSING_UNITS_QUESTIONS[DEFAULT_LANGUAGE];
}

/**
 * Returns the confirmation message sent after availability is successfully recorded.
 *
 * @param {string} [language]
 * @returns {string}
 */
export function getAvailabilityConfirmedMessage(language) {
  return AVAILABILITY_CONFIRMED_MESSAGES[language] ?? AVAILABILITY_CONFIRMED_MESSAGES[DEFAULT_LANGUAGE];
}

