import { describe, test, expect } from "@jest/globals";
import { calculateBudget } from "./budgetService.js";

describe("budgetService - calculateBudget", () => {
  test("1. Normal calculation matching prompt specification", () => {
    const payload = {
      travellers: 2,
      days: 4,
      budget: 25000,
      transport: { mode: "train", totalCost: 3000 },
      hotel: { pricePerNight: 2000, nights: 3 },
      food: { pricePerPersonPerDay: 350 },
      activities: [
        { name: "Golconda Fort", pricePerPerson: 25 },
        { name: "Salar Jung Museum", pricePerPerson: 50 },
      ],
      localTransport: { estimatedCost: 1200 },
    };

    const result = calculateBudget(payload);

    expect(result).toEqual({
      breakdown: {
        transport: 3000,
        hotel: 6000,
        food: 2800,
        activities: 150,
        localTransport: 1200,
      },
      totalCost: 13150,
      budget: 25000,
      remaining: 11850,
      utilizationPercent: 52.6,
      isOverBudget: false,
      largestCategory: "hotel",
    });
  });

  test("2. Missing optional categories should default to 0", () => {
    const payload = {
      travellers: 2,
      days: 3,
      budget: 10000,
      hotel: { pricePerNight: 1500, nights: 2 },
    };

    const result = calculateBudget(payload);

    expect(result.breakdown).toEqual({
      transport: 0,
      hotel: 3000,
      food: 0,
      activities: 0,
      localTransport: 0,
    });
    expect(result.totalCost).toBe(3000);
    expect(result.remaining).toBe(7000);
    expect(result.utilizationPercent).toBe(30);
    expect(result.isOverBudget).toBe(false);
    expect(result.largestCategory).toBe("hotel");
  });

  test("3. Empty activities array should yield 0 for activities cost", () => {
    const payload = {
      travellers: 3,
      days: 2,
      budget: 10000,
      transport: { totalCost: 1500 },
      activities: [],
    };

    const result = calculateBudget(payload);

    expect(result.breakdown.activities).toBe(0);
    expect(result.breakdown.transport).toBe(1500);
    expect(result.totalCost).toBe(1500);
    expect(result.remaining).toBe(8500);
    expect(result.utilizationPercent).toBe(15);
    expect(result.isOverBudget).toBe(false);
    expect(result.largestCategory).toBe("transport");
  });

  test("4. Over-budget case when totalCost exceeds budget", () => {
    const payload = {
      travellers: 2,
      days: 5,
      budget: 10000,
      hotel: { pricePerNight: 2000, nights: 5 }, // 10000
      transport: { totalCost: 4000 },
    };

    const result = calculateBudget(payload);

    expect(result.totalCost).toBe(14000);
    expect(result.budget).toBe(10000);
    expect(result.remaining).toBe(-4000);
    expect(result.utilizationPercent).toBe(140);
    expect(result.isOverBudget).toBe(true);
    expect(result.largestCategory).toBe("hotel");
  });

  test("5. Zero utilization case when no expenses are provided", () => {
    const payload = {
      travellers: 2,
      days: 3,
      budget: 15000,
    };

    const result = calculateBudget(payload);

    expect(result.breakdown).toEqual({
      transport: 0,
      hotel: 0,
      food: 0,
      activities: 0,
      localTransport: 0,
    });
    expect(result.totalCost).toBe(0);
    expect(result.budget).toBe(15000);
    expect(result.remaining).toBe(15000);
    expect(result.utilizationPercent).toBe(0);
    expect(result.isOverBudget).toBe(false);
    expect(result.largestCategory).toBeNull();
  });

  test("6. Decimal precision rounding to 2 decimal places", () => {
    const payload = {
      travellers: 3,
      days: 3,
      budget: 10000,
      food: { pricePerPersonPerDay: 333.333 }, // 333.333 * 3 * 3 = 2999.997 -> 3000
      transport: { totalCost: 123.456 }, // 123.46
    };

    const result = calculateBudget(payload);

    expect(result.breakdown.transport).toBe(123.46);
    expect(result.breakdown.food).toBe(3000);
    expect(result.totalCost).toBe(3123.46);
    expect(result.remaining).toBe(6876.54);
    expect(result.utilizationPercent).toBe(31.23);
  });
});
