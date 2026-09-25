import { sendMail } from "../../lib/mailer.js";
import { emergencyBroadcastEmail } from "../../lib/emailTemplates.js";

export const VALID_BROADCAST_SEVERITIES = ["info", "warning", "critical"];

/**
 * Create a platform-wide emergency broadcast and best-effort email every
 * account -- mirrors offers.controller.js's notifyRecipientsByEmail fan-out
 * pattern (User.find + Promise.all(sendMail)), just over every account
 * instead of a matched subset. Never lets one bad email address fail the
 * whole broadcast: the alert is already saved and live in the app (the
 * banner/notifications feed read it independent of email) before any mail
 * is even attempted.
 *
 * @param {Object} data
 * @param {string} data.title
 * @param {string} data.body
 * @param {string} [data.severity="critical"]
 * @param {string} data.createdBy - authority user id
 * @param {string} data.createdByName
 * @param {Object} models - { BroadcastAlertModel, UserModel, AuditLogModel }
 */
export async function sendBroadcastAlert({ title, body, severity = "critical", createdBy, createdByName }, models = {}) {
  const { BroadcastAlertModel, UserModel, AuditLogModel } = models;

  const cleanTitle = String(title || "").trim();
  const cleanBody = String(body || "").trim();
  if (!cleanTitle || !cleanBody) {
    return { success: false, status: 400, error: "BROADCAST_MISSING_FIELDS", message: "title and body are required" };
  }
  const cleanSeverity = VALID_BROADCAST_SEVERITIES.includes(severity) ? severity : "critical";

  const recipients = await UserModel.find({}).select("email fullName").lean().catch(() => []);

  const broadcast = await BroadcastAlertModel.create({
    title: cleanTitle,
    body: cleanBody,
    severity: cleanSeverity,
    createdBy,
    createdByName,
    recipientCount: recipients.length,
  });

  const appUrl = (process.env.CLIENT_URL || "http://localhost:5173").split(",")[0].trim();
  Promise.all(
    recipients.map((u) =>
      sendMail({
        to: u.email,
        ...emergencyBroadcastEmail({ fullName: u.fullName, title: cleanTitle, body: cleanBody, severity: cleanSeverity, appUrl }),
      }).catch(() => {})
    )
  ).catch(() => {});

  if (AuditLogModel) {
    await AuditLogModel.create({
      actor: String(createdBy),
      action: "broadcast_alert.sent",
      target: String(broadcast._id),
      reasonCode: "EMERGENCY_BROADCAST_SENT",
      meta: { severity: cleanSeverity, title: cleanTitle, recipientCount: recipients.length },
      at: new Date(),
    }).catch(() => {});
  }

  return { success: true, status: 201, broadcast, recipientCount: recipients.length };
}

export async function getActiveBroadcastAlerts(models = {}) {
  const { BroadcastAlertModel } = models;
  return BroadcastAlertModel.find({ active: true }).sort({ createdAt: -1 }).limit(20).lean();
}

export async function resolveBroadcastAlert(id, models = {}) {
  const { BroadcastAlertModel } = models;
  const updated = await BroadcastAlertModel.findByIdAndUpdate(
    id,
    { $set: { active: false, resolvedAt: new Date() } },
    { new: true }
  ).catch(() => null);
  if (!updated) return { success: false, status: 404, message: "broadcast alert not found" };
  return { success: true, status: 200, broadcast: updated };
}
