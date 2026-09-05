import { roundToTwo } from "../utils/money.js";

/**
 * Pure calculation service for budget and expense breakdown.
 * Does not depend on Express req or res objects for full testability.
 *
 * @param {Object} tripData - The trip payload containing budget, travellers, days, and cost categories.
 * @returns {Object} Structured cost breakdown, total, remaining, utilization %, and largest category.
 */
export function calculateBudget(tripData = {}) {
  const travellers = Number(tripData.travellers) || 0;
  const days = Number(tripData.days) || 0;
  const budget = roundToTwo(Number(tripData.budget) || 0);

  // 1. Transport cost
  // transport.totalCost is used as-is (already a total for the trip, not per person)
  const transportCost = Number(tripData.transport?.totalCost) || 0;

  // 2. Hotel cost
  // Assumption: Hotel price is calculated as pricePerNight * nights for the accommodation
  // as a whole (e.g. booked room/stay), and is NOT multiplied by the number of travellers.
  const pricePerNight = Number(tripData.hotel?.pricePerNight) || 0;
  const nights = Number(tripData.hotel?.nights) || 0;
  const hotelCost = pricePerNight * nights;

  // 3. Food cost
  // Calculated per person per day across all travellers and days
  const pricePerPersonPerDay = Number(tripData.food?.pricePerPersonPerDay) || 0;
  const foodCost = pricePerPersonPerDay * travellers * days;

  // 4. Activities cost
  // Sum of (pricePerPerson * travellers) for each activity in the array.
  // Missing or empty activities array defaults to 0.
  let activitiesCost = 0;
  if (Array.isArray(tripData.activities) && tripData.activities.length > 0) {
    activitiesCost = tripData.activities.reduce((acc, activity) => {
      const activityPrice = Number(activity?.pricePerPerson) || 0;
      return acc + (activityPrice * travellers);
    }, 0);
  }

  // 5. Local Transport cost
  // estimatedCost is used as-is
  const localTransportCost = Number(tripData.localTransport?.estimatedCost) || 0;

  // Compile breakdown with 2-decimal rounding
  const breakdown = {
    transport: roundToTwo(transportCost),
    hotel: roundToTwo(hotelCost),
    food: roundToTwo(foodCost),
    activities: roundToTwo(activitiesCost),
    localTransport: roundToTwo(localTransportCost),
  };

  // Total cost across all categories
  const totalCost = roundToTwo(
    breakdown.transport +
    breakdown.hotel +
    breakdown.food +
    breakdown.activities +
    breakdown.localTransport
  );

  // Remaining budget and utilization
  const remaining = roundToTwo(budget - totalCost);
  const utilizationPercent = budget > 0 ? roundToTwo((totalCost / budget) * 100) : 0;
  const isOverBudget = totalCost > budget;

  // Identify largest category
  // If all categories have 0 cost, largestCategory is null
  let largestCategory = null;
  let maxCost = 0;
  for (const [category, cost] of Object.entries(breakdown)) {
    if (cost > maxCost) {
      maxCost = cost;
      largestCategory = category;
    }
  }

  return {
    breakdown,
    totalCost,
    budget,
    remaining,
    utilizationPercent,
    isOverBudget,
    largestCategory,
  };
}
