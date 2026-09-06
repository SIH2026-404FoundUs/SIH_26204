import express from "express";
import { calculateTripBudget } from "../controllers/budgetController.js";
import { validateBudgetInput } from "../middleware/validateBudgetInput.js";

const router = express.Router();

// POST /api/v1/budget/calculate
router.post("/calculate", validateBudgetInput, calculateTripBudget);

export default router;
