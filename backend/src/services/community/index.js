/**
 * Community-Powered Destination Discovery Service Module
 *
 * Implements 6-step candidate submission pipeline, PoV authorization gate (>= 1 verified visit),
 * 5km geographic + name similarity deduplication, 30-day rate limit (max 3),
 * AI enrichment, queueing, and admin review approval promotion.
 */

export {
  submitCommunityDestination,
  reviewCommunitySubmission,
  getQueuedSubmissions,
  DEDUP_RADIUS_KM,
  DEDUP_SIMILARITY_THRESHOLD,
  MAX_SUBMISSIONS_PER_30_DAYS,
} from "./communityService.js";

export {
  calculateNameSimilarity,
  levenshteinDistance,
  slugify,
  normalizeText,
} from "./similarityUtils.js";
