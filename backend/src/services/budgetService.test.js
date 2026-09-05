import { describe, test, expect } from "@jest/globals";
import { calculateBudget } from "./budgetService.js";

describe("budgetService - calculateBudget", () => {
  test("1. Request with every source explicitly provided (hasUnlabelledEstimates: false)", () => {
    const payload = {
      tripId: "trip-xyz-101",
      destId: "dest-hyd-202",
      travellers: 2,
      days: 4,
      budget: 25000,
      transport: { mode: "train", totalCost: 3000, source: "provider:railradar" },
      hotel: { pricePerNight: 2000, nights: 3, source: "business_declared" },
      food: { pricePerPersonPerDay: 350, source: "manual" },
      activities: [
        { name: "Golconda Fort", pricePerPerson: 25, source: "provider:google_places" },
        { name: "Salar Jung Museum", pricePerPerson: 50, source: "provider:google_places" },
      ],
      localTransport: { estimatedCost: 1200, source: "seeded" },
    };

    const result = calculateBudget(payload);

    expect(result).toEqual({
      costBreakdown: {
        transport: { amount: 3000, source: "provider:railradar" },
        hotel: { amount: 6000, source: "business_declared" },
        food: { amount: 2800, source: "manual" },
        activities: { amount: 150, source: "provider:google_places" },
        localTransport: { amount: 1200, source: "seeded" },
      },
      totalCost: 13150,
      contingency: 1315,
      grandTotal: 14465,
      budget: 25000,
      remaining: 11850,
      utilizationPercent: 52.6,
      isOverBudget: false,
      reductionOptions: [],
      largestCategory: "hotel",
      tripId: "trip-xyz-101",
      destId: "dest-hyd-202",
      hasUnlabelledEstimates: false,
    });
  });

  test("2. Request with sources omitted entirely (hasUnlabelledEstimates: true, all defaulted to 'estimated')", () => {
    const payload = {
      travellers: 2,
      days: 4,
      budget: 25000,
      transport: { totalCost: 3000 },
      hotel: { pricePerNight: 2000, nights: 3 },
      food: { pricePerPersonPerDay: 350 },
      activities: [
        { name: "Fort", pricePerPerson: 25 },
      ],
      localTransport: { estimatedCost: 1200 },
    };

    const result = calculateBudget(payload);

    expect(result.costBreakdown).toEqual({
      transport: { amount: 3000, source: "estimated" },
      hotel: { amount: 6000, source: "estimated" },
      food: { amount: 2800, source: "estimated" },
      activities: { amount: 50, source: "estimated" },
      localTransport: { amount: 1200, source: "estimated" },
    });
    expect(result.tripId).toBeNull();
    expect(result.destId).toBeNull();
    expect(result.hasUnlabelledEstimates).toBe(true);
  });

  test("3. Unrecognised source string defaults to 'estimated' and is flagged", () => {
    const payload = {
      travellers: 2,
      days: 4,
      budget: 25000,
      transport: { totalCost: 3000, source: "unrecognised_source_xyz" },
      hotel: { pricePerNight: 2000, nights: 3, source: "business_declared" },
      food: { pricePerPersonPerDay: 350, source: "manual" },
      activities: [
        { name: "Fort", pricePerPerson: 25, source: "provider:google_places" },
      ],
      localTransport: { estimatedCost: 1200, source: "seeded" },
    };

    const result = calculateBudget(payload);

    expect(result.costBreakdown.transport).toEqual({
      amount: 3000,
      source: "estimated",
    });
    expect(result.hasUnlabelledEstimates).toBe(true);
  });

  test("4. tripId/destId echoed correctly when provided and null when omitted", () => {
    const withIds = calculateBudget({
      tripId: "trip-999",
      destId: "dest-888",
      travellers: 1,
      days: 1,
      budget: 1000,
    });
    expect(withIds.tripId).toBe("trip-999");
    expect(withIds.destId).toBe("dest-888");

    const withoutIds = calculateBudget({
      travellers: 1,
      days: 1,
      budget: 1000,
    });
    expect(withoutIds.tripId).toBeNull();
    expect(withoutIds.destId).toBeNull();
  });

  test("5. Activities with different sources resolve to 'mixed'", () => {
    const payload = {
      travellers: 2,
      days: 2,
      budget: 10000,
      transport: { totalCost: 1000, source: "manual" },
      hotel: { pricePerNight: 1000, nights: 1, source: "manual" },
      food: { pricePerPersonPerDay: 100, source: "manual" },
      activities: [
        { name: "Fort", pricePerPerson: 25, source: "provider:google_places" },
        { name: "Museum", pricePerPerson: 50, source: "manual" },
      ],
      localTransport: { estimatedCost: 200, source: "manual" },
    };

    const result = calculateBudget(payload);

    expect(result.costBreakdown.activities).toEqual({
      amount: 150,
      source: "mixed",
    });
    expect(result.hasUnlabelledEstimates).toBe(false);
  });

  test("6. Missing optional categories should default to 0 and 'estimated'", () => {
    const payload = {
      travellers: 2,
      days: 3,
      budget: 10000,
      hotel: { pricePerNight: 1500, nights: 2, source: "business_declared" },
    };

    const result = calculateBudget(payload);

    expect(result.costBreakdown).toEqual({
      transport: { amount: 0, source: "estimated" },
      hotel: { amount: 3000, source: "business_declared" },
      food: { amount: 0, source: "estimated" },
      activities: { amount: 0, source: "estimated" },
      localTransport: { amount: 0, source: "estimated" },
    });
    expect(result.totalCost).toBe(3000);
    expect(result.contingency).toBe(300);
    expect(result.grandTotal).toBe(3300);
    expect(result.remaining).toBe(7000);
    expect(result.utilizationPercent).toBe(30);
    expect(result.isOverBudget).toBe(false);
    expect(result.reductionOptions).toEqual([]);
    expect(result.largestCategory).toBe("hotel");
    expect(result.hasUnlabelledEstimates).toBe(true);
  });

  test("7. Empty activities array should yield 0 for activities cost with source 'estimated'", () => {
    const payload = {
      travellers: 3,
      days: 2,
      budget: 10000,
      transport: { totalCost: 1500, source: "manual" },
      activities: [],
    };

    const result = calculateBudget(payload);

    expect(result.costBreakdown.activities).toEqual({
      amount: 0,
      source: "estimated",
    });
    expect(result.costBreakdown.transport).toEqual({
      amount: 1500,
      source: "manual",
    });
    expect(result.totalCost).toBe(1500);
    expect(result.contingency).toBe(150);
    expect(result.grandTotal).toBe(1650);
    expect(result.remaining).toBe(8500);
    expect(result.utilizationPercent).toBe(15);
    expect(result.isOverBudget).toBe(false);
    expect(result.reductionOptions).toEqual([]);
    expect(result.largestCategory).toBe("transport");
    expect(result.hasUnlabelledEstimates).toBe(true);
  });

  test("8. Over-budget case when totalCost exceeds budget", () => {
    const payload = {
      travellers: 2,
      days: 5,
      budget: 10000,
      hotel: { pricePerNight: 2000, nights: 5 }, // 10000
      transport: { totalCost: 4000 },
    };

    const result = calculateBudget(payload);

    expect(result.totalCost).toBe(14000);
    expect(result.contingency).toBe(1400);
    expect(result.grandTotal).toBe(15400);
    expect(result.budget).toBe(10000);
    expect(result.remaining).toBe(-4000);
    expect(result.utilizationPercent).toBe(140);
    expect(result.isOverBudget).toBe(true);
    expect(result.largestCategory).toBe("hotel");
    expect(result.reductionOptions).toEqual([
      { type: "reduce_hotel_cost", description: expect.any(String) },
      { type: "switch_to_train", description: expect.any(String) },
      { type: "remove_activity", description: expect.any(String) },
      { type: "lower_pressure_alternative", description: expect.any(String) },
    ]);
  });

  test("9. Zero utilization case when no expenses are provided", () => {
    const payload = {
      travellers: 2,
      days: 3,
      budget: 15000,
    };

    const result = calculateBudget(payload);

    expect(result.costBreakdown).toEqual({
      transport: { amount: 0, source: "estimated" },
      hotel: { amount: 0, source: "estimated" },
      food: { amount: 0, source: "estimated" },
      activities: { amount: 0, source: "estimated" },
      localTransport: { amount: 0, source: "estimated" },
    });
    expect(result.totalCost).toBe(0);
    expect(result.contingency).toBe(0);
    expect(result.grandTotal).toBe(0);
    expect(result.budget).toBe(15000);
    expect(result.remaining).toBe(15000);
    expect(result.utilizationPercent).toBe(0);
    expect(result.isOverBudget).toBe(false);
    expect(result.reductionOptions).toEqual([]);
    expect(result.largestCategory).toBeNull();
  });

  test("10. Decimal precision rounding to 2 decimal places", () => {
    const payload = {
      travellers: 3,
      days: 3,
      budget: 10000,
      food: { pricePerPersonPerDay: 333.333 }, // 333.333 * 3 * 3 = 2999.997 -> 3000
      transport: { totalCost: 123.456 }, // 123.46
    };

    const result = calculateBudget(payload);

    expect(result.costBreakdown.transport.amount).toBe(123.46);
    expect(result.costBreakdown.food.amount).toBe(3000);
    expect(result.totalCost).toBe(3123.46);
    expect(result.contingency).toBe(312.35);
    expect(result.grandTotal).toBe(3435.81);
    expect(result.remaining).toBe(6876.54);
    expect(result.utilizationPercent).toBe(31.23);
  });

  test("11. Any provider: pattern string is accepted as valid source", () => {
    const payload = {
      travellers: 1,
      days: 1,
      budget: 5000,
      transport: { totalCost: 1000, source: "provider:custom_flight_api" },
      hotel: { pricePerNight: 1000, nights: 1, source: "provider:any_hotel_feed" },
      food: { pricePerPersonPerDay: 200, source: "provider:food_service" },
      activities: [
        { name: "Tower", pricePerPerson: 100, source: "provider:ticket_master" },
      ],
      localTransport: { estimatedCost: 50, source: "provider:uber_api" },
    };

    const result = calculateBudget(payload);

    expect(result.costBreakdown.transport.source).toBe("provider:custom_flight_api");
    expect(result.costBreakdown.hotel.source).toBe("provider:any_hotel_feed");
    expect(result.hasUnlabelledEstimates).toBe(false);
  });

  test("12. hotelCost multiplies pricePerNight * nights * rooms", () => {
    const payload = {
      travellers: 4,
      days: 3,
      budget: 50000,
      hotel: { pricePerNight: 2000, nights: 3, rooms: 2 },
    };

    const result = calculateBudget(payload);

    expect(result.costBreakdown.hotel.amount).toBe(12000); // 2000 * 3 * 2
    expect(result.totalCost).toBe(12000);
  });

  test("13. hotel.rooms defaults to 1 when omitted, preserving pre-rooms behaviour", () => {
    const payload = {
      travellers: 2,
      days: 2,
      budget: 10000,
      hotel: { pricePerNight: 1500, nights: 2 },
    };

    const result = calculateBudget(payload);

    expect(result.costBreakdown.hotel.amount).toBe(3000); // 1500 * 2 * 1
  });

  test("14. reductionOptions is empty when not over budget", () => {
    const payload = {
      travellers: 1,
      days: 1,
      budget: 10000,
      hotel: { pricePerNight: 1000, nights: 1 },
    };

    const result = calculateBudget(payload);

    expect(result.isOverBudget).toBe(false);
    expect(result.reductionOptions).toEqual([]);
  });

  test("15. reductionOptions returns exactly the four required options when over budget", () => {
    const payload = {
      travellers: 2,
      days: 2,
      budget: 1000,
      hotel: { pricePerNight: 5000, nights: 2, rooms: 1 },
    };

    const result = calculateBudget(payload);

    expect(result.isOverBudget).toBe(true);
    expect(result.reductionOptions).toHaveLength(4);
    expect(result.reductionOptions.map((o) => o.type)).toEqual([
      "reduce_hotel_cost",
      "switch_to_train",
      "remove_activity",
      "lower_pressure_alternative",
    ]);
    for (const option of result.reductionOptions) {
      expect(typeof option.description).toBe("string");
      expect(option.description.length).toBeGreaterThan(0);
    }
  });
});

