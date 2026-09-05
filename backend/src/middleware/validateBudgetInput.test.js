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
        budget: 25000,
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
        budget: 25000,
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

    const req2 = { body: { budget: 0, travellers: 2, days: 4 } };
    const res2 = mockResponse();
    validateBudgetInput(req2, res2, next1);
    expect(res2.status).toHaveBeenCalledWith(400);
  });

  test("rejects when travellers is missing or <= 0", () => {
    const req = { body: { budget: 10000, days: 4 } };
    const res = mockResponse();
    const next = jest.fn();
    validateBudgetInput(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: true, message: expect.stringContaining("travellers") })
    );
  });

  test("rejects when days is missing or <= 0", () => {
    const req = { body: { budget: 10000, travellers: 2, days: -1 } };
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
        body: { budget: 10000, travellers: 2, days: 3, transport: { totalCost: -100 } },
      },
      {
        field: "hotel.pricePerNight",
        body: { budget: 10000, travellers: 2, days: 3, hotel: { pricePerNight: -500, nights: 2 } },
      },
      {
        field: "hotel.nights",
        body: { budget: 10000, travellers: 2, days: 3, hotel: { pricePerNight: 500, nights: -2 } },
      },
      {
        field: "food.pricePerPersonPerDay",
        body: { budget: 10000, travellers: 2, days: 3, food: { pricePerPersonPerDay: -50 } },
      },
      {
        field: "localTransport.estimatedCost",
        body: { budget: 10000, travellers: 2, days: 3, localTransport: { estimatedCost: -200 } },
      },
      {
        field: "activities[0].pricePerPerson",
        body: { budget: 10000, travellers: 2, days: 3, activities: [{ pricePerPerson: -20 }] },
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
});
