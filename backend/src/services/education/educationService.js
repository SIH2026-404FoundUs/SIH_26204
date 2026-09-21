/**
 * Travel Education service (Revised Implementation Plan §8/§9).
 *
 * Structured destination knowledge, read-only-composed with the existing
 * Pressure Engine and verified-alerts pipeline at request time -- never a
 * cached pressure/safety snapshot baked into the education document
 * itself. Same dependency-injected `models` pattern as every other service
 * in this codebase.
 */

import { getDestination } from "../pressure/seed.js";
import { getPressure } from "../pressure/service.js";
import { getVerifiedAlerts } from "../alerts/alertService.js";
import { EDUCATION_STATUSES } from "../../models/travelEducation.model.js";

const today = () => new Date().toISOString().slice(0, 10);

// A traveller only ever sees "published" content -- draft/in_review stay
// internal to authority review tooling (getEducationForReview below).
// A destination with no education document at all is an honest, explicit
// "not authored yet" state, never a fabricated fallback.
export async function getEducationForTraveller(destId, models = {}) {
  const { TravelEducationModel } = models;
  const dest = getDestination(destId);
  if (!dest) return { success: false, status: 404, message: "unknown destination" };

  const doc = await TravelEducationModel.findOne({ destId, status: "published" }).lean();

  const [pressureRow, alerts] = await Promise.all([
    getPressure(destId, today()),
    getVerifiedAlerts({ destId }, models),
  ]);

  const pressureContext = pressureRow
    ? {
        score: pressureRow.score,
        stale: Boolean(pressureRow.stale),
        lowConfidence: Boolean(pressureRow.lowConfidence),
        template: doc?.pressureContextTemplate || null,
      }
    : null;

  if (!doc) {
    return {
      success: true,
      status: 200,
      education: null, // explicit "no education content authored for this destination yet"
      destId,
      displayName: dest.displayName,
      pressureContext,
      safetyAlerts: alerts,
    };
  }

  return {
    success: true,
    status: 200,
    education: doc,
    destId,
    displayName: dest.displayName,
    pressureContext,
    safetyAlerts: alerts,
  };
}

// Compact projection for a card/list view -- the Data Saver-friendly
// payload the plan (§9) explicitly calls for ("prefer summaries/cards
// first"). Same "published only, explicit null if unauthored" honesty.
export async function getEducationSummary(destId, models = {}) {
  const { TravelEducationModel } = models;
  const dest = getDestination(destId);
  if (!dest) return { success: false, status: 404, message: "unknown destination" };

  const doc = await TravelEducationModel.findOne({ destId, status: "published" })
    .select("overview bestTime budgetContext travelStyleTags lastReviewedAt")
    .lean();

  const pressureRow = await getPressure(destId, today());

  return {
    success: true,
    status: 200,
    destId,
    displayName: dest.displayName,
    education: doc || null,
    pressureContext: pressureRow ? { score: pressureRow.score, stale: Boolean(pressureRow.stale) } : null,
  };
}

// One section only (packing/safety) -- smaller payload still, for a
// traveller who only ever wants "what should I pack" on a slow connection.
export async function getEducationSection(destId, section, models = {}) {
  const { TravelEducationModel } = models;
  const dest = getDestination(destId);
  if (!dest) return { success: false, status: 404, message: "unknown destination" };

  const doc = await TravelEducationModel.findOne({ destId, status: "published" }).select(section).lean();

  if (section === "safety") {
    const alerts = await getVerifiedAlerts({ destId }, models);
    return { success: true, status: 200, destId, safety: doc?.safety || null, safetyAlerts: alerts };
  }
  return { success: true, status: 200, destId, [section]: doc?.[section] || null };
}

// Authority-authored content only -- this service never invents copy.
// Upsert so the same call authors a new destination's first draft or
// revises an existing one; version bumps on every real content change.
export async function upsertEducation(destId, data, models = {}) {
  const { TravelEducationModel } = models;
  const dest = getDestination(destId);
  if (!dest) return { success: false, status: 400, message: "unknown destId" };

  const allowedFields = [
    "overview", "bestTime", "gettingThere", "gettingAround", "localCulture", "etiquette",
    "responsibleTravel", "safety", "packing", "food", "accessibility", "budgetContext",
    "pressureContextTemplate", "travelStyleTags", "sources", "status",
  ];
  const update = {};
  for (const field of allowedFields) {
    if (data[field] !== undefined) update[field] = data[field];
  }
  if (update.status && !EDUCATION_STATUSES.includes(update.status)) {
    return { success: false, status: 400, message: `status must be one of: ${EDUCATION_STATUSES.join(", ")}` };
  }

  const existing = await TravelEducationModel.findOne({ destId });
  update.lastReviewedAt = new Date();
  update.version = (existing?.version || 0) + 1;

  const doc = await TravelEducationModel.findOneAndUpdate(
    { destId },
    { $set: update, $setOnInsert: { _id: destId, destId } },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
  );
  return { success: true, status: 200, education: doc };
}

export async function addEducationFeedback(destId, userId, { helpful, comment }, models = {}) {
  const { TravelEducationModel } = models;
  const doc = await TravelEducationModel.findOneAndUpdate(
    { destId, status: "published" },
    { $push: { feedback: { userId: String(userId), helpful, comment: typeof comment === "string" ? comment.trim().slice(0, 500) : undefined } } },
    { new: true }
  );
  if (!doc) return { success: false, status: 404, message: "no published education content for this destination" };
  return { success: true, status: 200 };
}
