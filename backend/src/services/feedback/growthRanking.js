/**
 * Business Growth Ranking Engine
 *
 * Implements Section 3.4 growth ranking formula to surface newly onboarded,
 * low-pressure local supply above established chains in crowded destinations.
 *
 * Formula:
 * rank = baseRelevance
 *        * (1 + 0.30 * isLocallyOnboarded)     // onboardedVia === "whatsapp"
 *        * (1 + 0.20 * tierWeight)             // self: 0, visit-verified: 0.5, registered: 1
 *        * (1 + 0.25 * isInLowPressureDest)
 */

/**
 * Get tier weight for verification status.
 * @param {string} tier - Business verification tier ('self-declared' | 'visit-verified' | 'registered').
 * @returns {number} Tier weight (0, 0.5, or 1.0).
 */
export function getTierWeight(tier) {
  switch (tier) {
    case "registered":
      return 1.0;
    case "visit-verified":
      return 0.5;
    case "self-declared":
    default:
      return 0;
  }
}

/**
 * Calculate the Business Growth Rank for a business listing.
 *
 * @param {Object} business - Business object.
 * @param {string} [business.onboardedVia] - Onboarding channel ('whatsapp' | 'web' | 'manual').
 * @param {string} [business.verificationTier] - Verification tier ('self-declared' | 'visit-verified' | 'registered').
 * @param {Object} [options] - Contextual options.
 * @param {number} [options.baseRelevance=1.0] - Base relevance score.
 * @param {boolean} [options.isInLowPressureDest=false] - True if business is located in a low-pressure destination.
 * @returns {{ rank: number, multipliers: Object }} Calculated rank and multiplier breakdown.
 */
export function calculateBusinessGrowthRank(business, options = {}) {
  if (!business) {
    return { rank: 0, multipliers: {} };
  }

  const baseRelevance = Number(options.baseRelevance ?? 1.0);
  const isInLowPressureDest = Boolean(options.isInLowPressureDest ?? false);

  // Signal 1: Local WhatsApp Onboarding (1 + 0.30 * isLocallyOnboarded)
  const isLocallyOnboarded = business.onboardedVia === "whatsapp" ? 1 : 0;
  const whatsappMultiplier = 1 + 0.30 * isLocallyOnboarded;

  // Signal 2: Verification Tier Weight (1 + 0.20 * tierWeight)
  const tierWeight = getTierWeight(business.verificationTier);
  const tierMultiplier = 1 + 0.20 * tierWeight;

  // Signal 3: Low-Pressure Destination Boost (1 + 0.25 * isInLowPressureDest)
  const pressureMultiplier = 1 + 0.25 * (isInLowPressureDest ? 1 : 0);

  // Combined growth rank score
  const rank = Math.round(baseRelevance * whatsappMultiplier * tierMultiplier * pressureMultiplier * 1000) / 1000;

  return {
    rank,
    multipliers: {
      baseRelevance,
      whatsappMultiplier,
      tierMultiplier,
      pressureMultiplier,
    },
  };
}

/**
 * Sort an array of businesses by calculated Growth Rank score descending.
 *
 * @param {Array<Object>} businesses - List of business objects.
 * @param {Object|Function} [optionsOrResolver] - Context options or custom low-pressure resolver.
 * @returns {Array<Object>} Sorted array of businesses with attached `growthRank` score.
 */
export function rankBusinessesForGrowth(businesses, optionsOrResolver = {}) {
  if (!Array.isArray(businesses)) return [];

  const ranked = businesses.map((bus) => {
    let isInLowPressure = false;
    let baseRelevance = 1.0;

    if (typeof optionsOrResolver === "function") {
      isInLowPressure = optionsOrResolver(bus.destId);
    } else if (optionsOrResolver && typeof optionsOrResolver === "object") {
      baseRelevance = optionsOrResolver.baseRelevance ?? 1.0;
      if (optionsOrResolver.lowPressureDestinations) {
        isInLowPressure = optionsOrResolver.lowPressureDestinations.includes(bus.destId);
      } else {
        isInLowPressure = Boolean(optionsOrResolver.isInLowPressureDest);
      }
    }

    const { rank, multipliers } = calculateBusinessGrowthRank(bus, {
      baseRelevance,
      isInLowPressureDest: isInLowPressure,
    });

    return {
      ...bus,
      growthRank: rank,
      growthMultipliers: multipliers,
    };
  });

  ranked.sort((a, b) => b.growthRank - a.growthRank);
  return ranked;
}
