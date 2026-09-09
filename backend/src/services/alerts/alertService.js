import crypto from "crypto";

/**
 * Real-Time Tourism Alerts & Safety Advisory Service
 *
 * Implements Section 3.3 verified advisory management:
 * - Mandatory attribution: Every alert MUST carry non-empty sourceUrl and sourceName.
 * - Idempotent upserts: sha256(destId + ":" + kind + ":" + normalizedBody) deduplication.
 * - Time validity filtering: Surfaces active advisories where validFrom <= now <= validTo.
 * - Agent wrapper tool: Formats verified alerts for ADK agent tool get_verified_alerts().
 *
 * STRICT REQUIREMENT: No crime-based safety scoring or crime prediction data is calculated,
 * stored, or returned anywhere in this service.
 */

export const VALID_ALERT_KINDS = ["weather", "road", "policy", "restriction", "hazard"];
export const VALID_SEVERITIES = ["info", "warning", "critical"];

/**
 * Normalize alert body text for hashing (lowercase, stripped whitespace & punctuation).
 * @param {string} text - Raw advisory text.
 * @returns {string} Normalized string.
 */
export function normalizeAlertText(text) {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[^\w\s]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Calculate sha256 hash for alert deduplication.
 * hash = sha256(destId + ":" + kind + ":" + normalizedBody)
 *
 * @param {string} destId - Destination slug.
 * @param {string} kind - Alert kind.
 * @param {string} body - Advisory text.
 * @returns {string} SHA256 hex string.
 */
export function calculateAlertHash(destId, kind, body) {
  const normDest = String(destId || "").toLowerCase().trim();
  const normKind = String(kind || "").toLowerCase().trim();
  const normBody = normalizeAlertText(body);

  const raw = `${normDest}:${normKind}:${normBody}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/**
 * Ingest or update a verified advisory alert.
 * Enforces mandatory sourceUrl and sourceName provenance.
 *
 * @param {Object} alertData - Advisory parameters.
 * @param {string} alertData.destId - Canonical destination slug (e.g. "shimla").
 * @param {string} alertData.kind - 'weather'|'road'|'policy'|'restriction'|'hazard'.
 * @param {string} alertData.body - Advisory text.
 * @param {string} alertData.sourceUrl - Mandatory source URL.
 * @param {string} alertData.sourceName - Mandatory source attribution name.
 * @param {string} [alertData.severity="info"] - 'info'|'warning'|'critical'.
 * @param {Date|string} [alertData.validFrom=now] - Validity start date.
 * @param {Date|string} alertData.validTo - Mandatory validity end date.
 *
 * @param {Object} [models] - Database models (AlertModel, AuditLogModel).
 * @returns {Promise<Object>} Ingestion result object.
 */
export async function ingestAlert(alertData, models = {}) {
  const { AlertModel, AuditLogModel } = models;
  const {
    destId,
    kind,
    body,
    sourceUrl,
    sourceName,
    severity = "info",
    validFrom = new Date(),
    validTo,
  } = alertData;

  // Step 1: Validate required fields
  if (!destId || !kind || !body || !validTo) {
    return {
      success: false,
      status: 400,
      error: "ALERT_MISSING_PARAMETERS",
      message: "destId, kind, body, and validTo are required",
    };
  }

  // Step 2: MANDATORY PROVENANCE CHECK — Reject if sourceUrl or sourceName is missing/empty
  const cleanSourceUrl = String(sourceUrl || "").trim();
  const cleanSourceName = String(sourceName || "").trim();

  if (!cleanSourceUrl || !cleanSourceName) {
    return {
      success: false,
      status: 400,
      error: "ALERT_ATTRIBUTION_REQUIRED",
      message: "Every alert must carry a non-empty sourceUrl and sourceName for verified attribution",
    };
  }

  const cleanKind = String(kind).toLowerCase().trim();
  if (!VALID_ALERT_KINDS.includes(cleanKind)) {
    return {
      success: false,
      status: 400,
      error: "INVALID_ALERT_KIND",
      message: `kind must be one of: ${VALID_ALERT_KINDS.join(", ")}`,
    };
  }

  const cleanSeverity = VALID_SEVERITIES.includes(severity) ? severity : "info";

  // Step 3: Compute sha256 hash for idempotent upsert
  const hash = calculateAlertHash(destId, cleanKind, body);
  const now = new Date();

  const alertPayload = {
    destId: String(destId).toLowerCase().trim(),
    kind: cleanKind,
    severity: cleanSeverity,
    body: String(body).trim(),
    sourceUrl: cleanSourceUrl,
    sourceName: cleanSourceName,
    validFrom: new Date(validFrom),
    validTo: new Date(validTo),
    fetchedAt: now,
    hash,
  };

  let upsertedDoc = null;
  if (AlertModel && typeof AlertModel.findOneAndUpdate === "function") {
    upsertedDoc = await AlertModel.findOneAndUpdate(
      { hash },
      { $set: alertPayload },
      { upsert: true, new: true, returnDocument: "after" }
    );
  } else {
    upsertedDoc = {
      _id: "alert_" + hash.substring(0, 10),
      ...alertPayload,
    };
  }

  if (AuditLogModel && typeof AuditLogModel.create === "function") {
    await AuditLogModel.create({
      actor: "system",
      action: "alert.ingested",
      target: String(upsertedDoc._id || hash),
      reasonCode: "VERIFIED_ALERT_UPSERTED",
      meta: { destId, kind: cleanKind, sourceName: cleanSourceName },
      at: now,
    }).catch(() => {});
  }

  return {
    success: true,
    status: 200,
    alert: upsertedDoc,
  };
}

/**
 * Fetch verified active advisories for a destination or trip route.
 * Filters out expired alerts (validTo < now) or inactive alerts (validFrom > now).
 * Wraps your alerts endpoint directly for Nishith's ADK agent tool get_verified_alerts().
 *
 * @param {Object} query - Query options.
 * @param {string} query.destId - Canonical destination slug (e.g. "shimla").
 * @param {string} [query.kind] - Optional filter by kind ('weather'|'road'|'policy'|'restriction'|'hazard').
 * @param {Date} [now=new Date()] - Reference timestamp.
 *
 * @param {Object} [models] - Database models (AlertModel).
 * @returns {Promise<Array<Object>>} Array of active verified alerts.
 */
export async function getVerifiedAlerts(query = {}, models = {}, now = new Date()) {
  const { AlertModel } = models;
  const { destId, kind } = query;

  if (!destId) return [];

  const filter = {
    destId: String(destId).toLowerCase().trim(),
    validTo: { $gte: now },
    validFrom: { $lte: now },
  };

  if (kind && VALID_ALERT_KINDS.includes(kind.toLowerCase())) {
    filter.kind = kind.toLowerCase();
  }

  let activeAlerts = [];
  if (AlertModel && typeof AlertModel.find === "function") {
    const q = AlertModel.find(filter);
    activeAlerts = q && typeof q.sort === "function" ? await q.sort({ validTo: 1 }) : await q;
  }

  // Format clean output payload with mandatory source attribution
  return activeAlerts.map(formatAlert);
}

function formatAlert(a) {
  return {
    _id: a._id,
    destId: a.destId,
    kind: a.kind,
    severity: a.severity || "info",
    body: a.body,
    sourceUrl: a.sourceUrl, // Mandatory provenance
    sourceName: a.sourceName, // Mandatory provenance
    validFrom: a.validFrom,
    validTo: a.validTo,
    fetchedAt: a.fetchedAt,
    hash: a.hash,
  };
}

/**
 * Fetch verified alerts for a destination whose validity window overlaps a
 * given date range -- for the traveller-facing Notifications feature (UI
 * spec §8/9), which needs to know "is there a verified alert relevant to
 * THIS trip's planned dates", not just "what's active right now" like
 * getVerifiedAlerts()/GET /api/v1/alerts is for (that one stays untouched --
 * it's wrapped directly by Nishith's agent tool and the existing Alerts
 * page, both of which want "current" advisories). Same Alert collection,
 * same output shape, no separate alert data source -- just a different,
 * additive query against it.
 *
 * @param {Object} query
 * @param {string} query.destId
 * @param {string|Date} query.startDate
 * @param {string|Date} query.endDate
 * @param {Object} [models] - Database models (AlertModel).
 * @returns {Promise<Array<Object>>}
 */
export async function getAlertsForDateRange(query = {}, models = {}) {
  const { AlertModel } = models;
  const { destId, startDate, endDate } = query;
  if (!destId || !startDate) return [];

  const rangeStart = new Date(startDate);
  const rangeEnd = endDate ? new Date(endDate) : rangeStart;
  if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) return [];

  const filter = {
    destId: String(destId).toLowerCase().trim(),
    validFrom: { $lte: rangeEnd },
    validTo: { $gte: rangeStart },
  };

  let alerts = [];
  if (AlertModel && typeof AlertModel.find === "function") {
    const q = AlertModel.find(filter);
    alerts = q && typeof q.sort === "function" ? await q.sort({ validFrom: 1 }) : await q;
  }

  return alerts.map(formatAlert);
}

/**
 * Background polling job to ingest sample/external alerts (Open-Meteo, State PWD, ASI monument closures).
 *
 * @param {Array<Object>} feedAlerts - Incoming raw alert objects.
 * @param {Object} [models] - Database models.
 * @returns {Promise<{ ingestedCount: number, errors: Array<Object> }>} Job execution summary.
 */
export async function pollAlertsJob(feedAlerts = [], models = {}) {
  if (!Array.isArray(feedAlerts) || feedAlerts.length === 0) {
    return { ingestedCount: 0, errors: [] };
  }

  let ingestedCount = 0;
  const errors = [];

  for (const raw of feedAlerts) {
    const result = await ingestAlert(raw, models);
    if (result.success) {
      ingestedCount++;
    } else {
      errors.push({ alert: raw, error: result.message || result.error });
    }
  }

  return { ingestedCount, errors };
}
