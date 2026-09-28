import Business from "../models/business.model.js";
import { isValidCalendarDate } from "../lib/dateValidation.js";
import { buildRevenueDashboard, simulatePrices } from "../services/revenue/revenueEngine.js";
import { logger } from "../lib/logger.js";

const today = () => new Date().toISOString().slice(0, 10);
const MAX_FORECAST_DAYS = 30;

// Same ownership pattern every other operator-scoped endpoint in this
// codebase uses (businesses.controller.js, offers.controller.js,
// waitlist.controller.js) -- an operator can only ever run revenue
// intelligence against a business they actually own.
async function ownedBusiness(req) {
  if (req.user.role !== "operator") return { error: { status: 403, message: "operator role required" } };
  const business = await Business.findById(req.params.businessId);
  if (!business) return { error: { status: 404, message: "business not found" } };
  if (String(business.ownerUserId || "") !== String(req.user._id)) {
    return { error: { status: 403, message: "business owner role required" } };
  }
  return { business };
}

// GET /api/v1/revenue/:businessId/dashboard?date=YYYY-MM-DD&days=7
export const getRevenueDashboardController = async (req, res) => {
  try {
    const { business, error } = await ownedBusiness(req);
    if (error) return res.status(error.status).json({ message: error.message });

    const date = req.query.date || today();
    if (!isValidCalendarDate(date)) {
      return res.status(400).json({ message: "date must be a real calendar date in YYYY-MM-DD format" });
    }
    const days = Number(req.query.days) || 7;
    if (!Number.isInteger(days) || days < 1 || days > MAX_FORECAST_DAYS) {
      return res.status(400).json({ message: `days must be a whole number between 1 and ${MAX_FORECAST_DAYS}` });
    }

    const dashboard = await buildRevenueDashboard(business, { today: date, forecastDays: days });
    res.status(200).json(dashboard);
  } catch (error) {
    logger.error("Error in getRevenueDashboard controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// POST /api/v1/revenue/:businessId/simulate  { date, prices: number[] }
export const simulateRevenueController = async (req, res) => {
  try {
    const { business, error } = await ownedBusiness(req);
    if (error) return res.status(error.status).json({ message: error.message });

    const { date, prices } = req.body;
    if (!isValidCalendarDate(date)) {
      return res.status(400).json({ message: "date must be a real calendar date in YYYY-MM-DD format" });
    }
    if (!Array.isArray(prices) || prices.length === 0 || prices.length > 10) {
      return res.status(400).json({ message: "prices must be a non-empty array of up to 10 numbers" });
    }
    const cleanPrices = prices.map(Number);
    if (cleanPrices.some((p) => !Number.isFinite(p) || p < 0)) {
      return res.status(400).json({ message: "every price must be a non-negative number" });
    }

    const result = await simulatePrices(business, date, cleanPrices);
    res.status(200).json(result);
  } catch (error) {
    logger.error("Error in simulateRevenue controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
