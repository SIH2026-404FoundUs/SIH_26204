/**
 * Community-Powered Destination Discovery Service Module
 *
 * Implements 6-step candidate submission pipeline, PoV authorization gate (>= 1 verified visit),
 * 5km geographic + name similarity deduplication, AI enrichment, queueing, and admin
 * review approval promotion. No cap on how many places a traveller can suggest.
 */

export {
  submitCommunityDestination,
  reviewCommunitySubmission,
  getQueuedSubmissions,
  DEDUP_RADIUS_KM,
  DEDUP_SIMILARITY_THRESHOLD,
} from "./communityService.js";

export {
  calculateNameSimilarity,
  levenshteinDistance,
  slugify,
  normalizeText,
} from "./similarityUtils.js";
