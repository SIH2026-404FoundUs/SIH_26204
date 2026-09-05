import { calculateBudget } from "../services/budgetService.js";
import Budget from "../models/Budget.js";

/**
 * Controller to calculate budget for trip expenses.
 * Handles POST /api/v1/budget/calculate
 */
export const calculateTripBudget = async (req, res) => {
  try {
    const result = calculateBudget(req.body);

    // Optional analytics persistence (non-blocking, never fails the calculation)
    try {
      if (Budget.db?.readyState === 1) {
        Budget.create({
          travellers: req.body.travellers,
          days: req.body.days,
          budget: req.body.budget,
          transport: req.body.transport,
          hotel: req.body.hotel,
          food: req.body.food,
          activities: req.body.activities,
          localTransport: req.body.localTransport,
          ...result,
        }).catch((dbErr) => {
          console.warn("Optional Budget persistence skipped/failed:", dbErr.message);
        });
      }
    } catch (saveErr) {
      console.warn("Optional Budget persistence initialization error:", saveErr.message);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in calculateTripBudget controller:", error);
    return res.status(500).json({
      error: true,
      message: "Internal server error while calculating budget",
    });
  }
};
