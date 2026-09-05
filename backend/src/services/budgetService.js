import { roundToTwo } from "../utils/money.js";

const ALLOWED_SOURCES = new Set([
  "business_declared",
  "provider:amadeus",
  "provider:railradar",
  "provider:google_places",
  "provider:open_meteo",
  "seeded",
  "estimated",
  "manual",
]);

/**
 * Checks if a given source string is valid according to allowed sources or provider pattern.
 *
 * @param {any} source
 * @returns {boolean}
 */
function isValidSource(source) {
  if (typeof source !== "string") {
    return false;
  }
  if (ALLOWED_SOURCES.has(source)) {
    return true;
  }
  return /^provider:.+/.test(source);
}

/**
 * Resolves a category's source string. Missing or unrecognized sources default to "estimated"
 * and are flagged as unlabelled.
 *
 * @param {any} rawSource
 * @returns {{ source: string, wasDefaulted: boolean }}
 */
function resolveCategorySource(rawSource) {
  if (isValidSource(rawSource)) {
    return { source: rawSource, wasDefaulted: false };
  }
  return { source: "estimated", wasDefaulted: true };
}

/**
 * Pure calculation service for budget and expense breakdown.
 * Does not depend on Express req or res objects for full testability.
 *
 * @param {Object} tripData - The trip payload containing budget, travellers, days, and cost categories.
 * @returns {Object} Structured cost breakdown, total, remaining, utilization %, largest category, tripId, destId, hasUnlabelledEstimates.
 */
export function calculateBudget(tripData = {}) {
  const travellers = Number(tripData.travellers) || 0;
  const days = Number(tripData.days) || 0;
  const budget = roundToTwo(Number(tripData.budget) || 0);

  // Top-level tripId and destId (default to null if not provided)
  const tripId = tripData.tripId !== undefined ? tripData.tripId : null;
  const destId = tripData.destId !== undefined ? tripData.destId : null;

  // 1. Transport cost & source
  const transportCost = Number(tripData.transport?.totalCost) || 0;
  const transportSourceInfo = resolveCategorySource(tripData.transport?.source);

  // 2. Hotel cost & source
  const pricePerNight = Number(tripData.hotel?.pricePerNight) || 0;
  const nights = Number(tripData.hotel?.nights) || 0;
  const hotelCost = pricePerNight * nights;
  const hotelSourceInfo = resolveCategorySource(tripData.hotel?.source);

  // 3. Food cost & source
  const pricePerPersonPerDay = Number(tripData.food?.pricePerPersonPerDay) || 0;
  const foodCost = pricePerPersonPerDay * travellers * days;
  const foodSourceInfo = resolveCategorySource(tripData.food?.source);

  // 4. Activities cost & source
  let activitiesCost = 0;
  let activitiesSource = "estimated";
  let activitiesHaveUnlabelled = false;

  if (Array.isArray(tripData.activities) && tripData.activities.length > 0) {
    const activitySources = [];
    for (const activity of tripData.activities) {
      const activityPrice = Number(activity?.pricePerPerson) || 0;
      activitiesCost += activityPrice * travellers;

      const sourceInfo = resolveCategorySource(activity?.source);
      if (sourceInfo.wasDefaulted) {
        activitiesHaveUnlabelled = true;
      }
      activitySources.push(sourceInfo.source);
    }

    const firstSource = activitySources[0];
    const allSame = activitySources.every((src) => src === firstSource);
    activitiesSource = allSame ? firstSource : "mixed";
  } else {
    activitiesCost = 0;
    activitiesSource = "estimated";
    activitiesHaveUnlabelled = true;
  }

  // 5. Local Transport cost & source
  const localTransportCost = Number(tripData.localTransport?.estimatedCost) || 0;
  const localTransportSourceInfo = resolveCategorySource(tripData.localTransport?.source);

  // Compile costBreakdown with 2-decimal rounding and source labels
  const costBreakdown = {
    transport: {
      amount: roundToTwo(transportCost),
      source: transportSourceInfo.source,
    },
    hotel: {
      amount: roundToTwo(hotelCost),
      source: hotelSourceInfo.source,
    },
    food: {
      amount: roundToTwo(foodCost),
      source: foodSourceInfo.source,
    },
    activities: {
      amount: roundToTwo(activitiesCost),
      source: activitiesSource,
    },
    localTransport: {
      amount: roundToTwo(localTransportCost),
      source: localTransportSourceInfo.source,
    },
  };

  // Flag true if ANY category or activity had its source defaulted
  const hasUnlabelledEstimates =
    transportSourceInfo.wasDefaulted ||
    hotelSourceInfo.wasDefaulted ||
    foodSourceInfo.wasDefaulted ||
    localTransportSourceInfo.wasDefaulted ||
    activitiesHaveUnlabelled;

  // Total cost across all categories
  const totalCost = roundToTwo(
    costBreakdown.transport.amount +
    costBreakdown.hotel.amount +
    costBreakdown.food.amount +
    costBreakdown.activities.amount +
    costBreakdown.localTransport.amount
  );

  // Remaining budget and utilization
  const remaining = roundToTwo(budget - totalCost);
  const utilizationPercent = budget > 0 ? roundToTwo((totalCost / budget) * 100) : 0;
  const isOverBudget = totalCost > budget;

  // Identify largest category by amount
  // If all categories have 0 cost, largestCategory is null
  let largestCategory = null;
  let maxCost = 0;
  for (const [category, item] of Object.entries(costBreakdown)) {
    if (item.amount > maxCost) {
      maxCost = item.amount;
      largestCategory = category;
    }
  }

  return {
    costBreakdown,
    totalCost,
    budget,
    remaining,
    utilizationPercent,
    isOverBudget,
    largestCategory,
    tripId,
    destId,
    hasUnlabelledEstimates,
  };
}

