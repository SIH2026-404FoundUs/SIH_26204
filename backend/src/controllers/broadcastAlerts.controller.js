import BroadcastAlert from "../models/broadcastAlert.model.js";
import User from "../models/user.model.js";
import AuditLog from "../models/auditLog.model.js";
import {
  sendBroadcastAlert,
  getActiveBroadcastAlerts,
  resolveBroadcastAlert,
} from "../services/alerts/broadcastAlertService.js";
import { logger } from "../lib/logger.js";

const models = { BroadcastAlertModel: BroadcastAlert, UserModel: User, AuditLogModel: AuditLog };

// POST /api/v1/broadcast-alerts -- authority-only, emails every account and
// makes the alert live for the banner every page polls (see
// broadcastAlertService.js's own comment on why this isn't routed through
// the externally-sourced Alert collection).
export const sendBroadcastAlertController = async (req, res) => {
  try {
    if (req.user.role !== "authority") return res.status(403).json({ message: "authority role required" });
    const { title, body, severity } = req.body;
    const result = await sendBroadcastAlert(
      { title, body, severity, createdBy: req.user._id, createdByName: req.user.fullName },
      models
    );
    res.status(result.status).json(result);
  } catch (error) {
    logger.error("Error in sendBroadcastAlert controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// GET /api/v1/broadcast-alerts -- public (no protectRoute): a disaster
// notice has to reach a visitor who hasn't signed in yet too, same posture
// as GET /api/v1/alerts.
export const getActiveBroadcastAlertsController = async (req, res) => {
  try {
    const alerts = await getActiveBroadcastAlerts(models);
    res.status(200).json(alerts);
  } catch (error) {
    logger.error("Error in getActiveBroadcastAlerts controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// PATCH /api/v1/broadcast-alerts/:id/resolve -- authority-only, clears it
// from every account's banner/feed once the situation is over.
export const resolveBroadcastAlertController = async (req, res) => {
  try {
    if (req.user.role !== "authority") return res.status(403).json({ message: "authority role required" });
    const result = await resolveBroadcastAlert(req.params.id, models);
    res.status(result.status).json(result);
  } catch (error) {
    logger.error("Error in resolveBroadcastAlert controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
