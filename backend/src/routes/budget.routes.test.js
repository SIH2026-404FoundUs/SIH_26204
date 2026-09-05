import { describe, test, expect } from "@jest/globals";
import express from "express";
import budgetRoutes from "./budget.routes.js";

describe("budget.routes integration", () => {
  const createTestApp = () => {
    const app = express();
    app.use(express.json());
    app.use("/api/v1/budget", budgetRoutes);
    return app;
  };

  test("POST /api/v1/budget/calculate returns 200 with valid payload", async () => {
    const app = createTestApp();
    const server = app.listen(0);
    const { port } = server.address();

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/v1/budget/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({
        costBreakdown: {
          transport: { amount: 3000, source: "estimated" },
          hotel: { amount: 6000, source: "estimated" },
          food: { amount: 2800, source: "estimated" },
          activities: { amount: 150, source: "estimated" },
          localTransport: { amount: 1200, source: "estimated" },
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
        tripId: null,
        destId: null,
        hasUnlabelledEstimates: true,
      });
    } finally {
      server.close();
    }
  });

  test("POST /api/v1/budget/calculate returns 400 with missing budget", async () => {
    const app = createTestApp();
    const server = app.listen(0);
    const { port } = server.address();

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/v1/budget/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          travellers: 2,
          days: 4,
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toEqual({
        error: true,
        message: "budget is required and must be a number greater than 0",
      });
    } finally {
      server.close();
    }
  });

  test("POST /api/v1/budget/calculate returns 400 with negative hotel price", async () => {
    const app = createTestApp();
    const server = app.listen(0);
    const { port } = server.address();

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/v1/budget/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          travellers: 2,
          days: 4,
          budget: 25000,
          hotel: { pricePerNight: -200, nights: 2 },
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe(true);
      expect(data.message).toContain("hotel pricePerNight cannot be negative");
    } finally {
      server.close();
    }
  });

  test("POST /api/v1/budget/calculate returns 200 with empty activities array", async () => {
    const app = createTestApp();
    const server = app.listen(0);
    const { port } = server.address();

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/v1/budget/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          travellers: 2,
          days: 4,
          budget: 25000,
          activities: [],
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.costBreakdown.activities.amount).toBe(0);
      expect(data.costBreakdown.activities.source).toBe("estimated");
    } finally {
      server.close();
    }
  });

  test("POST /api/v1/budget/calculate returns 400 with negative hotel rooms", async () => {
    const app = createTestApp();
    const server = app.listen(0);
    const { port } = server.address();

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/v1/budget/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          travellers: 2,
          days: 4,
          budget: 25000,
          hotel: { pricePerNight: 2000, nights: 2, rooms: -1 },
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe(true);
      expect(data.message).toContain("hotel rooms cannot be negative");
    } finally {
      server.close();
    }
  });

  test("POST /api/v1/budget/calculate multiplies hotel cost by rooms and returns contingency/grandTotal", async () => {
    const app = createTestApp();
    const server = app.listen(0);
    const { port } = server.address();

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/v1/budget/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          travellers: 2,
          days: 2,
          budget: 5000,
          hotel: { pricePerNight: 2000, nights: 2, rooms: 2 },
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.costBreakdown.hotel.amount).toBe(8000); // 2000 * 2 * 2
      expect(data.totalCost).toBe(8000);
      expect(data.contingency).toBe(800);
      expect(data.grandTotal).toBe(8800);
    } finally {
      server.close();
    }
  });

  test("POST /api/v1/budget/calculate returns all four reductionOptions when over budget", async () => {
    const app = createTestApp();
    const server = app.listen(0);
    const { port } = server.address();

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/v1/budget/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          travellers: 2,
          days: 2,
          budget: 500,
          hotel: { pricePerNight: 5000, nights: 2 },
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.isOverBudget).toBe(true);
      expect(data.reductionOptions).toHaveLength(4);
      expect(data.reductionOptions.map((o) => o.type)).toEqual([
        "reduce_hotel_cost",
        "switch_to_train",
        "remove_activity",
        "lower_pressure_alternative",
      ]);
    } finally {
      server.close();
    }
  });
});
