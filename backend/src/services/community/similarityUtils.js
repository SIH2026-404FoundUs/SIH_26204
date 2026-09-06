/**
 * Community Discovery Similarity & String Utilities
 *
 * Implements Levenshtein distance and normalized string similarity
 * for 5km deduplication checks.
 */

/**
 * Convert string to canonical slug (e.g., "Hidden Water Falls!" -> "hidden-water-falls").
 *
 * @param {string} text - Input text string.
 * @returns {string} Canonical slug string.
 */
export function slugify(text) {
  if (!text) return "";
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

/**
 * Normalize string for similarity comparison (lowercase, stripped punctuation, single spaces).
 *
 * @param {string} str - Raw text string.
 * @returns {string} Normalized string.
 */
export function normalizeText(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/[^\w\s]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Calculate Levenshtein edit distance between two strings.
 *
 * @param {string} a - String 1.
 * @param {string} b - String 2.
 * @returns {number} Edit distance integer.
 */
export function levenshteinDistance(a, b) {
  const str1 = normalizeText(a);
  const str2 = normalizeText(b);

  if (str1 === str2) return 0;
  if (str1.length === 0) return str2.length;
  if (str2.length === 0) return str1.length;

  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Calculate normalized similarity score between 0.0 and 1.0 for two place names.
 *
 * @param {string} name1 - Place name 1.
 * @param {string} name2 - Place name 2.
 * @returns {number} Normalized similarity score (1.0 = identical, 0.0 = completely different).
 */
export function calculateNameSimilarity(name1, name2) {
  const norm1 = normalizeText(name1);
  const norm2 = normalizeText(name2);

  if (!norm1 || !norm2) return 0;
  if (norm1 === norm2) return 1.0;

  // Substring inclusion shortcut (e.g., "Kalka Temple" vs "Kalka Mata Temple")
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    const minLen = Math.min(norm1.length, norm2.length);
    const maxLen = Math.max(norm1.length, norm2.length);
    if (minLen / maxLen >= 0.6) {
      return 0.85;
    }
  }

  const distance = levenshteinDistance(norm1, norm2);
  const maxLength = Math.max(norm1.length, norm2.length);

  if (maxLength === 0) return 1.0;

  const similarity = 1.0 - distance / maxLength;
  return Math.max(0, Math.min(1.0, similarity));
}
