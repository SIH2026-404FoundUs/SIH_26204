/**
 * Worker Role -- Gig Matching Service
 *
 * Implements the lifecycle from worker-role-spec.md §03/§04: an operator
 * posts a GigRequest, the system immediately pushes GigMatch "offered" rows
 * to every available matching worker (push-first), the first worker to
 * accept claims it, headcount tracks how many are still needed, and either
 * side can mark the match complete and rate the other.
 *
 * Same dependency-injected `models` pattern as every other service in this
 * codebase (complaintService.js, waitlistService.js, communityService.js) --
 * real Mongoose models in production, swappable for tests.
 */

import { GOVERNMENT_ID_TYPES } from "../../models/workerProfile.model.js";

// GigRequest.status transitions: open -> matched (at least one offer sent,
// none accepted yet) -> filled (headcount met) -> cancelled/expired.
// "matched" is set right after the push fan-out below, distinct from "open"
// (posted, nothing sent yet -- true only for a fraction of a second) so a
// stale "open" GigRequest genuinely means nobody was found to notify.

export async function createOrUpdateWorkerProfile(userId, data, models = {}) {
  const { WorkerProfileModel } = models;
  const { skills, serviceAreaDestIds, rateExpectation, languages, onboardedVia, legalName, governmentId } = data;

  // Legal name and a government ID are mandatory -- an operator deciding
  // whether to accept a gig offer needs to know who they're actually
  // hiring, not just a skill tag, so this can't be left blank the way rate
  // expectation or languages can.
  const cleanLegalName = typeof legalName === "string" ? legalName.trim() : "";
  const cleanIdType = governmentId?.idType;
  const cleanIdNumber = typeof governmentId?.idNumber === "string" ? governmentId.idNumber.trim() : "";
  if (!cleanLegalName || !GOVERNMENT_ID_TYPES.includes(cleanIdType) || !cleanIdNumber) {
    return {
      success: false,
      status: 400,
      message: "legalName and a valid governmentId (idType + idNumber) are required",
    };
  }

  const update = {
    legalName: cleanLegalName.slice(0, 120),
    governmentId: { idType: cleanIdType, idNumber: cleanIdNumber.slice(0, 40) },
  };
  if (Array.isArray(skills)) update.skills = skills;
  if (Array.isArray(serviceAreaDestIds)) update.serviceAreaDestIds = serviceAreaDestIds;
  if (rateExpectation && typeof rateExpectation === "object") update.rateExpectation = rateExpectation;
  if (Array.isArray(languages)) update.languages = languages;
  if (onboardedVia) update.onboardedVia = onboardedVia;

  // Create-or-update, same upsert convention as
  // businesses.controller.js's upsertBusinessAvailabilityController --
  // "POST /v1/workers" is honestly both "create my profile" the first time
  // and "edit my profile" every time after, one endpoint either way.
  const profile = await WorkerProfileModel.findOneAndUpdate(
    { userId },
    { $set: update, $setOnInsert: { userId } },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
  );
  return { success: true, status: 200, profile };
}

export async function updateWorkerAvailability(userId, { mode, windows }, models = {}) {
  const { WorkerProfileModel } = models;
  const update = {};
  if (mode) update["availability.mode"] = mode;
  if (Array.isArray(windows)) update["availability.windows"] = windows;
  if (Object.keys(update).length === 0) {
    return { success: false, status: 400, message: "mode or windows is required" };
  }
  const profile = await WorkerProfileModel.findOneAndUpdate({ userId }, { $set: update }, { new: true });
  if (!profile) return { success: false, status: 404, message: "worker profile not found -- create one first" };
  return { success: true, status: 200, profile };
}

export async function getWorkerProfileByUserId(userId, models = {}) {
  const { WorkerProfileModel } = models;
  return WorkerProfileModel.findOne({ userId }).lean();
}

// GET /v1/gigs?destId&skill -- the browse side of push-first-browse-second
// (spec §04): open gigs a worker who wasn't notified, or is just checking
// in, can still self-serve.
export async function listOpenGigs({ destId, skill, limit = 50, skip = 0 }, models = {}) {
  const { GigRequestModel } = models;
  const filter = { status: { $in: ["open", "matched"] } };
  if (destId) filter.destId = destId;
  if (skill) filter.skillNeeded = skill;
  return GigRequestModel.find(filter).sort({ startDate: 1 }).skip(skip).limit(limit).lean();
}

// A worker is a real candidate for a gig if their skills/service area match
// and they are actually free for the gig's window -- either permanently "on
// call" (mode "now") or with a scheduled window overlapping [startDate,
// endDate]. Windows are simple date ranges at MVP weight (spec's own
// "display state only" framing for finer scheduling), so overlap is a plain
// date comparison, not a time-of-day one.
function isWorkerAvailableFor(profile, startDate, endDate) {
  if (profile.availability?.mode === "now") return true;
  const windows = profile.availability?.windows || [];
  return windows.some((w) => {
    const wd = new Date(w.date).getTime();
    return wd >= new Date(startDate).getTime() && wd <= new Date(endDate).getTime();
  });
}

async function findMatchingWorkers(gigRequest, models = {}) {
  const { WorkerProfileModel } = models;
  const candidates = await WorkerProfileModel.find({
    skills: gigRequest.skillNeeded,
    serviceAreaDestIds: gigRequest.destId,
  }).lean();
  return candidates.filter((w) => isWorkerAvailableFor(w, gigRequest.startDate, gigRequest.endDate));
}

// The push half of push-first-browse-second: every matching, available
// worker gets a GigMatch "offered" row the moment a gig is posted. Returns
// the matched worker docs (their userId is what a caller needs to actually
// notify them by email/WhatsApp) so the controller can fan out
// notifications without this function knowing anything about mailers.
export async function matchGigToWorkers(gigRequest, models = {}) {
  const { GigMatchModel, GigRequestModel } = models;
  const matches = await findMatchingWorkers(gigRequest, models);
  if (matches.length === 0) return { matchCount: 0, matchedWorkers: [] };

  await GigMatchModel.insertMany(
    matches.map((w) => ({ gigRequestId: gigRequest._id, workerId: w._id, status: "offered" })),
    { ordered: false } // one duplicate-key collision (re-run) must not block the rest
  ).catch(() => {}); // best-effort fan-out, same convention as processOfferMatching's own notification writes

  await GigRequestModel.updateOne({ _id: gigRequest._id, status: "open" }, { $set: { status: "matched" } });
  return { matchCount: matches.length, matchedWorkers: matches };
}

export async function createGigRequest(operatorUserId, data, models = {}) {
  const { GigRequestModel } = models;
  const { businessId, destId, skillNeeded, startDate, endDate, headcount, budget, notes } = data;

  if (!destId || !skillNeeded || !startDate || !endDate) {
    return { success: false, status: 400, message: "destId, skillNeeded, startDate, and endDate are required" };
  }
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return { success: false, status: 400, message: "endDate must be a valid date on or after startDate" };
  }

  const gigRequest = await GigRequestModel.create({
    operatorUserId,
    businessId: businessId || undefined,
    destId,
    skillNeeded,
    startDate: start,
    endDate: end,
    headcount: Number(headcount) > 0 ? Number(headcount) : 1,
    budget: budget && typeof budget === "object" ? budget : undefined,
    notes: typeof notes === "string" ? notes.trim().slice(0, 500) : undefined,
  });

  const { matchCount, matchedWorkers } = await matchGigToWorkers(gigRequest, models);
  // matchGigToWorkers writes the "matched" transition straight to the DB
  // (a targeted updateOne, not a full re-save of this in-memory document) --
  // mirror it here too, so the object handed back in the response reflects
  // what was actually just written instead of the pre-match "open" status.
  if (matchCount > 0) gigRequest.status = "matched";
  return { success: true, status: 201, gigRequest, matchCount, matchedWorkers };
}

// POST /v1/gigs/:id/accept -- atomic single-worker claim, same
// findOneAndUpdate-with-guard shape claimOfferAtomic (offerService.js) uses
// for exactly the same "only the first request through this door wins"
// problem. Two different collections, same race.
export async function acceptGig(gigRequestId, workerUserId, models = {}) {
  const { GigRequestModel, GigMatchModel, WorkerProfileModel } = models;

  const profile = await WorkerProfileModel.findOne({ userId: workerUserId });
  if (!profile) return { success: false, status: 404, message: "create a worker profile before accepting gigs" };

  const gigRequest = await GigRequestModel.findById(gigRequestId);
  if (!gigRequest) return { success: false, status: 404, message: "gig not found" };

  // The atomic step: this exact worker's own offered row flips to accepted
  // only if it is still "offered" right now -- a second accept attempt (a
  // double-tap, a stale tab) finds nothing to update and fails cleanly
  // instead of racing.
  const match = await GigMatchModel.findOneAndUpdate(
    { gigRequestId, workerId: profile._id, status: "offered" },
    { $set: { status: "accepted", respondedAt: new Date() } },
    { new: true }
  );
  if (!match) {
    return { success: false, status: 409, message: "This gig is no longer available to you -- it may already be filled or you weren't matched to it." };
  }

  const acceptedCount = await GigMatchModel.countDocuments({ gigRequestId, status: "accepted" });
  if (acceptedCount >= gigRequest.headcount) {
    // Headcount met -- close the loop: the GigRequest stops accepting new
    // claims, and every worker still sitting on an unanswered "offered" row
    // for it has that offer withdrawn, honestly (spec §03: "others
    // auto-expire") rather than left to dangle forever.
    await GigRequestModel.updateOne({ _id: gigRequestId }, { $set: { status: "filled" } });
    await GigMatchModel.updateMany(
      { gigRequestId, status: "offered" },
      { $set: { status: "cancelled" } }
    );
  }

  return { success: true, status: 200, match, gigRequest };
}

// Either side can mark a gig done. A worker completes only their own match;
// an operator (who must own the GigRequest) completes every currently
// "accepted" match under it -- honest for the common headcount-1 case and
// for the "close out everyone at once" operator convenience on a
// multi-worker gig.
export async function completeGig(gigRequestId, actorUserId, actorRole, models = {}) {
  const { GigRequestModel, GigMatchModel, WorkerProfileModel } = models;
  const gigRequest = await GigRequestModel.findById(gigRequestId);
  if (!gigRequest) return { success: false, status: 404, message: "gig not found" };

  if (actorRole === "operator") {
    if (String(gigRequest.operatorUserId) !== String(actorUserId)) {
      return { success: false, status: 403, message: "you did not post this gig" };
    }
    const result = await GigMatchModel.updateMany(
      { gigRequestId, status: "accepted" },
      { $set: { status: "completed", completedAt: new Date() } }
    );
    return { success: true, status: 200, completedCount: result.modifiedCount ?? result.nModified ?? 0 };
  }

  const profile = await WorkerProfileModel.findOne({ userId: actorUserId });
  if (!profile) return { success: false, status: 404, message: "worker profile not found" };
  const match = await GigMatchModel.findOneAndUpdate(
    { gigRequestId, workerId: profile._id, status: "accepted" },
    { $set: { status: "completed", completedAt: new Date() } },
    { new: true }
  );
  if (!match) return { success: false, status: 404, message: "no accepted match found for you on this gig" };
  return { success: true, status: 200, match };
}

// Recomputes WorkerProfile.rating from every ratingByOperator score ever
// recorded for that worker's completed matches -- a real average over real
// ratings, never a running increment that could drift from the source rows.
async function recomputeWorkerRating(workerId, models = {}) {
  const { GigMatchModel, WorkerProfileModel } = models;
  const rated = await GigMatchModel.find({ workerId, "ratingByOperator.score": { $exists: true } })
    .select("ratingByOperator.score")
    .lean();
  if (rated.length === 0) return;
  const avg = rated.reduce((sum, m) => sum + m.ratingByOperator.score, 0) / rated.length;
  await WorkerProfileModel.updateOne(
    { _id: workerId },
    { $set: { "rating.avg": Math.round(avg * 10) / 10, "rating.count": rated.length } }
  );
}

// Both directions rate (spec §07: "a worker rating the operator matters as
// much as the reverse"). Only WorkerProfile carries an aggregate rating --
// there is no OperatorProfile collection to aggregate the reverse into, so
// an operator's ratingByWorker entries are recorded per-match, honestly,
// without inventing a reputation system nothing else in this spec asks for.
export async function rateGig(gigRequestId, actorUserId, actorRole, { score, comment }, models = {}) {
  const { GigRequestModel, GigMatchModel, WorkerProfileModel } = models;
  const numScore = Number(score);
  if (!Number.isInteger(numScore) || numScore < 1 || numScore > 5) {
    return { success: false, status: 400, message: "score must be an integer from 1 to 5" };
  }

  const gigRequest = await GigRequestModel.findById(gigRequestId).lean();
  if (!gigRequest) return { success: false, status: 404, message: "gig not found" };

  const ratingValue = { score: numScore, comment: typeof comment === "string" ? comment.trim().slice(0, 500) : undefined, ratedAt: new Date() };

  if (actorRole === "operator") {
    if (String(gigRequest.operatorUserId) !== String(actorUserId)) {
      return { success: false, status: 403, message: "you did not post this gig" };
    }
    // An operator rates the worker(s) who actually did the job -- every
    // completed match under this gig gets the same rating in one call
    // (matches completeGig's own "whole gig at once" operator convenience).
    const matches = await GigMatchModel.find({ gigRequestId, status: "completed" });
    if (matches.length === 0) return { success: false, status: 400, message: "no completed match to rate yet" };
    await Promise.all(
      matches.map(async (m) => {
        m.ratingByOperator = ratingValue;
        await m.save();
        await recomputeWorkerRating(m.workerId, models);
      })
    );
    return { success: true, status: 200, ratedCount: matches.length };
  }

  const profile = await WorkerProfileModel.findOne({ userId: actorUserId }).lean();
  if (!profile) return { success: false, status: 404, message: "worker profile not found" };
  const match = await GigMatchModel.findOneAndUpdate(
    { gigRequestId, workerId: profile._id, status: "completed" },
    { $set: { ratingByWorker: ratingValue } },
    { new: true }
  );
  if (!match) return { success: false, status: 404, message: "no completed match found for you on this gig" };
  return { success: true, status: 200, match };
}

// GET /v1/operators/me/gigs -- "Track posted gigs & status" (spec §05),
// each enriched with its own accepted/offered counts so an operator can see
// fill progress without a second round trip per gig.
export async function getOperatorGigs(operatorUserId, models = {}) {
  const { GigRequestModel, GigMatchModel } = models;
  const gigRequests = await GigRequestModel.find({ operatorUserId }).sort({ createdAt: -1 }).lean();
  if (gigRequests.length === 0) return [];

  const ids = gigRequests.map((g) => g._id);
  const matches = await GigMatchModel.find({ gigRequestId: { $in: ids } }).lean();
  const byGig = new Map();
  for (const m of matches) {
    const key = String(m.gigRequestId);
    if (!byGig.has(key)) byGig.set(key, []);
    byGig.get(key).push(m);
  }

  return gigRequests.map((g) => {
    const gigMatches = byGig.get(String(g._id)) || [];
    return {
      ...g,
      offeredCount: gigMatches.filter((m) => m.status === "offered").length,
      acceptedCount: gigMatches.filter((m) => m.status === "accepted").length,
      completedCount: gigMatches.filter((m) => m.status === "completed").length,
    };
  });
}

// Additive beyond the spec's literal API table (which lists no "worker's
// own gigs" read endpoint), but the spec's own Screens section (§06)
// requires a "My Jobs -- accepted, upcoming, and history" screen, which
// needs exactly this. Named to match getOperatorGigs's own shape.
export async function getWorkerGigs(workerUserId, models = {}) {
  const { WorkerProfileModel, GigMatchModel, GigRequestModel } = models;
  const profile = await WorkerProfileModel.findOne({ userId: workerUserId }).lean();
  if (!profile) return [];

  const matches = await GigMatchModel.find({ workerId: profile._id }).sort({ createdAt: -1 }).lean();
  if (matches.length === 0) return [];

  const gigIds = matches.map((m) => m.gigRequestId);
  const gigRequests = await GigRequestModel.find({ _id: { $in: gigIds } }).lean();
  const gigById = new Map(gigRequests.map((g) => [String(g._id), g]));

  return matches
    .map((m) => ({ match: m, gig: gigById.get(String(m.gigRequestId)) || null }))
    .filter((row) => row.gig != null);
}
