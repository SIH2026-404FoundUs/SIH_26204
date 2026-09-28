import { getVerifiedAlerts, getAlertsForDateRange, ingestAlert } from "../services/alerts/alertService.js";
import Alert from "../models/alert.model.js";
import AuditLog from "../models/auditLog.model.js";
import { logger } from "../lib/logger.js";

const models = { AlertModel: Alert, AuditLogModel: AuditLog };

// GET /api/v1/alerts?destId=&kind= — wrapped directly by Nishith's agent tool
// get_verified_alerts() (spec §3.3). Public: safety advisories are not gated behind auth.
export const getAlertsController = async (req, res) => {
  try {
    const { destId, kind } = req.query;
    if (!destId) return res.status(400).json({ message: "destId query param required" });
    res.status(200).json(await getVerifiedAlerts({ destId, kind }, models));
  } catch (error) {
    logger.error("Error in getAlerts controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// GET /api/v1/alerts/for-trip?destId=&startDate=&endDate= — traveller
// Notifications feature (UI spec §8/9): alerts whose validity window
// overlaps a specific trip's dates, not just what's active today. Same
// public read as GET /api/v1/alerts, just a different, additive filter.
export const getAlertsForTripController = async (req, res) => {
  try {
    const { destId, startDate, endDate } = req.query;
    if (!destId || !startDate) {
      return res.status(400).json({ message: "destId and startDate query params required" });
    }
    res.status(200).json(await getAlertsForDateRange({ destId, startDate, endDate }, models));
  } catch (error) {
    logger.error("Error in getAlertsForTrip controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// POST /api/v1/alerts — ingest one verified advisory. jobs/pollAlerts.js calls
// ingestAlert() directly with the same payload shape; this route exists so an
// authority can hand-add an advisory (e.g. during the demo) without a DB console.
export const ingestAlertController = async (req, res) => {
  try {
    if (req.user.role !== "authority") {
      return res.status(403).json({ message: "authority role required" });
    }
    const result = await ingestAlert(req.body, models);
    res.status(result.status).json(result);
  } catch (error) {
    logger.error("Error in ingestAlert controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
