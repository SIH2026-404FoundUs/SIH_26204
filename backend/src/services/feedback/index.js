/**
 * AI Tourist Feedback Intelligence, Business Growth Ranking & Multilingual Translation Service Module
 *
 * Implements:
 * - Section 3.2: Feedback collection, batch AI theme extraction (mentions >= 3), evidenceIdx mapping, and improvement actions.
 * - Section 3.4: Business Growth Ranking multiplier formula (isLocallyOnboarded, tierWeight, isInLowPressureDest).
 * - Section 3.5: Multilingual translation service for Indic feedback & localized safety advisories.
 */

export {
  submitTouristFeedback,
  processBusinessFeedback,
  getBusinessFeedbackInsights,
  extractFeedbackThemesAndActions,
  MIN_FEEDBACK_THRESHOLD,
  MIN_THEME_MENTIONS_THRESHOLD,
  VALID_CATEGORIES,
} from "./feedbackService.js";

export {
  calculateBusinessGrowthRank,
  rankBusinessesForGrowth,
  getTierWeight,
} from "./growthRanking.js";

export {
  translateText,
  translateFeedbackReviews,
  translateAlertForTourist,
  SUPPORTED_LANGUAGES,
} from "./translationService.js";
