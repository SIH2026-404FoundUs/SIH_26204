/**
 * Multilingual Translation Service (Integrated in Feedback & Alerts Subsystems)
 *
 * Provides text translation for non-English feedback reviews and safety advisories
 * supporting Indic languages (Hindi, Telugu, Tamil, Kannada, Bengali, Marathi, Gujarati, Punjabi).
 *
 * Integrates directly into the 5 allocated service folders without creating extra root service directories.
 */

export const SUPPORTED_LANGUAGES = {
  en: "English",
  hi: "Hindi",
  te: "Telugu",
  ta: "Tamil",
  kn: "Kannada",
  bn: "Bengali",
  mr: "Marathi",
  gu: "Gujarati",
  pa: "Punjabi",
};

// Common Indic tourism phrase translation dictionary for offline/fast fallback
const INDIC_TRANSLATION_FALLBACKS = {
  hi: {
    "clean room": "कमरा साफ था",
    "dirty room": "कमरा गंदा था",
    "good food": "खाना अच्छा था",
    "bad service": "सेवा खराब थी",
    "staff was polite": "कर्मचारी विनम्र थे",
    "heavy snowfall alert": "भारी बर्फबारी की चेतावनी",
    "road closed": "सड़क बंद है",
  },
  te: {
    "clean room": "గది శుభ్రంగా ఉంది",
    "dirty room": "గది మురికిగా ఉంది",
    "good food": "ఆహారం బాగుంది",
    "bad service": "సేవ బాగాలేదు",
    "heavy snowfall alert": "భారీ మంచు కురిసే హెచ్చరిక",
    "road closed": "రహదారి మూసివేయబడింది",
  },
};

/**
 * Translate input text to a target language.
 * Uses external FastAPI Qwen3 translator if endpoint provided, or local Indic fallback engine.
 *
 * @param {Object} params - Translation parameters.
 * @param {string} params.text - Input text string to translate.
 * @param {string} [params.targetLanguage="en"] - Target ISO language code ('en', 'hi', 'te', etc.).
 * @param {string} [params.sourceLanguage="auto"] - Source language code.
 *
 * @param {Object} [options] - Optional runtime options (aiServiceUrl, axiosClient).
 * @returns {Promise<{ success: boolean, originalText: string, translatedText: string, sourceLang: string, targetLang: string }>} Translation result.
 */
export async function translateText(params, options = {}) {
  const { text, targetLanguage = "en", sourceLanguage = "auto" } = params;
  const { aiServiceUrl, fetchClient } = options;

  if (!text || typeof text !== "string") {
    return {
      success: false,
      originalText: "",
      translatedText: "",
      sourceLang: sourceLanguage,
      targetLang: targetLanguage,
    };
  }

  const cleanText = text.trim();
  const cleanTarget = String(targetLanguage).toLowerCase().trim();

  // If already in target language (or English default with ascii characters)
  if (cleanTarget === "en" && /^[\x00-\x7F]+$/.test(cleanText)) {
    return {
      success: true,
      originalText: cleanText,
      translatedText: cleanText,
      sourceLang: "en",
      targetLang: "en",
    };
  }

  // Attempt external FastAPI Qwen3 translation service if URL provided
  if (aiServiceUrl && typeof fetchClient === "function") {
    try {
      const response = await fetchClient(`${aiServiceUrl}/internal/ai/translate`, {
        text: cleanText,
        target_lang: cleanTarget,
        source_lang: sourceLanguage,
      });

      if (response && response.translated_text) {
        return {
          success: true,
          originalText: cleanText,
          translatedText: response.translated_text,
          sourceLang: response.detected_source_lang || sourceLanguage,
          targetLang: cleanTarget,
        };
      }
    } catch (err) {
      console.warn("[Translation Warning] AI translation service unavailable, using fallback:", err.message);
    }
  }

  // Fallback Indic dictionary lookup
  const dict = INDIC_TRANSLATION_FALLBACKS[cleanTarget];
  let fallbackResult = cleanText;

  if (dict) {
    const lower = cleanText.toLowerCase();
    for (const [key, value] of Object.entries(dict)) {
      if (lower.includes(key)) {
        fallbackResult = value;
        break;
      }
    }
  }

  return {
    success: true,
    originalText: cleanText,
    translatedText: fallbackResult,
    sourceLang: sourceLanguage,
    targetLang: cleanTarget,
    isFallback: true,
  };
}

/**
 * Translate array of feedback review comments into English for AI theme processing.
 *
 * @param {Array<Object>} reviews - Array of feedback review objects [{ comment, rating }].
 * @param {Object} [options] - Translation options.
 * @returns {Promise<Array<Object>>} Translated review array.
 */
export async function translateFeedbackReviews(reviews, options = {}) {
  if (!Array.isArray(reviews)) return [];

  const translatedReviews = [];
  for (const rev of reviews) {
    const res = await translateText({ text: rev.comment, targetLanguage: "en" }, options);
    translatedReviews.push({
      ...rev,
      comment: res.translatedText,
      originalComment: rev.comment,
    });
  }

  return translatedReviews;
}

/**
 * Translate safety advisory alert body for tourists in their selected language.
 *
 * @param {Object} alert - Alert object ({ body, kind, sourceName }).
 * @param {string} targetLanguage - Target ISO language code ('hi', 'te', etc.).
 * @param {Object} [options] - Translation options.
 * @returns {Promise<Object>} Alert with translated body.
 */
export async function translateAlertForTourist(alert, targetLanguage = "en", options = {}) {
  if (!alert || !alert.body) return alert;

  const res = await translateText(
    { text: alert.body, targetLanguage },
    options
  );

  return {
    ...alert,
    body: res.translatedText,
    originalBody: alert.body,
    translatedLanguage: targetLanguage,
  };
}
