import { jest, describe, test, expect } from "@jest/globals";
import { validateBudgetInput } from "./validateBudgetInput.js";

describe("validateBudgetInput middleware", () => {
  const mockResponse = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  test("passes validation with full valid payload", () => {
    const req = {
      body: {
        travellers: 2,
        days: 4,
        budgetINR: 25000,
        transport: { mode: "train", totalCost: 3000 },
        hotel: { pricePerNight: 2000, nights: 3 },
        food: { pricePerPersonPerDay: 350 },
        activities: [{ name: "Fort", pricePerPerson: 25 }],
        localTransport: { estimatedCost: 1200 },
      },
    };
    const res = mockResponse();
    const next = jest.fn();

    validateBudgetInput(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test("passes validation when optional categories are omitted", () => {
    const req = {
      body: {
        travellers: 2,
        days: 4,
        budgetINR: 25000,
      },
    };
    const res = mockResponse();
    const next = jest.fn();

    validateBudgetInput(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test("rejects when budget is missing or <= 0", () => {
    const req1 = { body: { travellers: 2, days: 4 } };
    const res1 = mockResponse();
    const next1 = jest.fn();
    validateBudgetInput(req1, res1, next1);
    expect(res1.status).toHaveBeenCalledWith(400);
    expect(res1.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: true, message: expect.any(String) })
    );

    const req2 = { body: { budgetINR: 0, travellers: 2, days: 4 } };
    const res2 = mockResponse();
    validateBudgetInput(req2, res2, next1);
    expect(res2.status).toHaveBeenCalledWith(400);
  });

  test("rejects when travellers is missing or <= 0", () => {
    const req = { body: { budgetINR: 10000, days: 4 } };
    const res = mockResponse();
    const next = jest.fn();
    validateBudgetInput(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: true, message: expect.stringContaining("travellers") })
    );
  });

  test("rejects when days is missing or <= 0", () => {
    const req = { body: { budgetINR: 10000, travellers: 2, days: -1 } };
    const res = mockResponse();
    const next = jest.fn();
    validateBudgetInput(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: true, message: expect.stringContaining("days") })
    );
  });

  test("rejects when any provided cost field is negative", () => {
    const testCases = [
      {
        field: "transport.totalCost",
        body: { budgetINR: 10000, travellers: 2, days: 3, transport: { totalCost: -100 } },
      },
      {
        field: "hotel.pricePerNight",
        body: { budgetINR: 10000, travellers: 2, days: 3, hotel: { pricePerNight: -500, nights: 2 } },
      },
      {
        field: "hotel.nights",
        body: { budgetINR: 10000, travellers: 2, days: 3, hotel: { pricePerNight: 500, nights: -2 } },
      },
      {
        field: "hotel.rooms",
        body: { budgetINR: 10000, travellers: 2, days: 3, hotel: { pricePerNight: 500, nights: 2, rooms: -1 } },
      },
      {
        field: "food.pricePerPersonPerDay",
        body: { budgetINR: 10000, travellers: 2, days: 3, food: { pricePerPersonPerDay: -50 } },
      },
      {
        field: "localTransport.estimatedCost",
        body: { budgetINR: 10000, travellers: 2, days: 3, localTransport: { estimatedCost: -200 } },
      },
      {
        field: "activities[0].pricePerPerson",
        body: { budgetINR: 10000, travellers: 2, days: 3, activities: [{ pricePerPerson: -20 }] },
      },
    ];

    for (const tc of testCases) {
      const res = mockResponse();
      const next = jest.fn();
      validateBudgetInput({ body: tc.body }, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: true, message: expect.any(String) })
      );
      expect(next).not.toHaveBeenCalled();
    }
  });

  test("defaults tripId and destId to null when omitted, and passes through when provided", () => {
    const req1 = {
      body: {
        budgetINR: 10000,
        travellers: 2,
        days: 3,
      },
    };
    const res1 = mockResponse();
    const next1 = jest.fn();
    validateBudgetInput(req1, res1, next1);
    expect(next1).toHaveBeenCalled();
    expect(req1.body.tripId).toBeNull();
    expect(req1.body.destId).toBeNull();

    const req2 = {
      body: {
        tripId: "trip-abc",
        destId: "dest-xyz",
        budgetINR: 10000,
        travellers: 2,
        days: 3,
      },
    };
    const res2 = mockResponse();
    const next2 = jest.fn();
    validateBudgetInput(req2, res2, next2);
    expect(next2).toHaveBeenCalled();
    expect(req2.body.tripId).toBe("trip-abc");
    expect(req2.body.destId).toBe("dest-xyz");
  });

  test("tolerates missing or unrecognised source strings without throwing 400", () => {
    const req = {
      body: {
        budgetINR: 10000,
        travellers: 2,
        days: 3,
        transport: { totalCost: 1000, source: "unknown_source_string" },
        hotel: { pricePerNight: 500, nights: 2, source: "business_declared" },
        activities: [{ pricePerPerson: 20, source: "invalid_xyz" }],
      },
    };
    const res = mockResponse();
    const next = jest.fn();
    validateBudgetInput(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test("passes validation with a positive hotel.rooms value, and when rooms is omitted", () => {
    const withRooms = {
      body: {
        budgetINR: 10000,
        travellers: 4,
        days: 3,
        hotel: { pricePerNight: 2000, nights: 3, rooms: 2 },
      },
    };
    const res1 = mockResponse();
    const next1 = jest.fn();
    validateBudgetInput(withRooms, res1, next1);
    expect(next1).toHaveBeenCalled();
    expect(res1.status).not.toHaveBeenCalled();

    const withoutRooms = {
      body: {
        budgetINR: 10000,
        travellers: 2,
        days: 3,
        hotel: { pricePerNight: 2000, nights: 3 },
      },
    };
    const res2 = mockResponse();
    const next2 = jest.fn();
    validateBudgetInput(withoutRooms, res2, next2);
    expect(next2).toHaveBeenCalled();
    expect(res2.status).not.toHaveBeenCalled();
  });
});

