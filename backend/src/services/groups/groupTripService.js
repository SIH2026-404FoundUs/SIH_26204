/**
 * Group Travel lifecycle (Revised Implementation Plan §10/§11/§13/§19).
 *
 * GroupTrip is a parallel object to the existing Trip model -- this
 * service never touches Trip/redistribution logic. It reuses the
 * canonical destination resolver, reads the Pressure Engine read-only for
 * snapshots, and enforces capacity atomically (never read-increment-save
 * in application code).
 *
 * Same dependency-injected `models` pattern as every other service here.
 */

import { getDestination } from "../pressure/seed.js";
import { getPressure } from "../pressure/service.js";
import { computeMatchFactors } from "./groupMatching.js";

const today = () => new Date().toISOString().slice(0, 10);

function isValidDate(value) {
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

async function captureSnapshot(destId) {
  const row = await getPressure(destId, today());
  if (!row) return { score: null, capturedAt: new Date(), confidence: "low" };
  return {
    score: row.score,
    capturedAt: new Date(),
    confidence: row.stale ? "stale" : row.lowConfidence ? "low" : "normal",
  };
}

// POST /group-trips -- creator becomes the first accepted member
// (currentMembers starts at 1, matching GroupTrip.model.js's own default).
export async function createGroupTrip(creatorId, data, models = {}) {
  const { GroupTripModel, GroupTripMemberModel } = models;
  const { destId, startDate, endDate, travelTypes, activities, pace, budgetRange, preferredGroupSize, maxMembers, joinPolicy } = data;

  const dest = getDestination(destId);
  if (!dest) return { success: false, status: 400, message: "unknown destId" };
  if (!startDate || !endDate || !isValidDate(startDate) || !isValidDate(endDate)) {
    return { success: false, status: 400, message: "startDate and endDate must be valid dates" };
  }
  if (new Date(endDate) < new Date(startDate)) {
    return { success: false, status: 400, message: "endDate must be >= startDate" };
  }
  const max = Number(maxMembers);
  if (!Number.isInteger(max) || max < 2) {
    return { success: false, status: 400, message: "maxMembers must be an integer of at least 2" };
  }
  if (budgetRange?.min != null && budgetRange?.max != null && budgetRange.min > budgetRange.max) {
    return { success: false, status: 400, message: "budgetRange.min must be <= budgetRange.max" };
  }

  const pressureSnapshot = await captureSnapshot(destId);

  const group = await GroupTripModel.create({
    creatorId,
    destId,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    travelTypes: Array.isArray(travelTypes) ? travelTypes : [],
    activities: Array.isArray(activities) ? activities : [],
    pace: pace || undefined,
    budgetRange: budgetRange || undefined,
    preferredGroupSize: preferredGroupSize || undefined,
    maxMembers: max,
    currentMembers: 1,
    joinPolicy: joinPolicy === "open" ? "open" : "request",
    status: "open",
    pressureSnapshot,
  });

  await GroupTripMemberModel.create({
    groupTripId: group._id,
    userId: creatorId,
    role: "creator",
    status: "accepted",
    joinedAt: new Date(),
  });

  return { success: true, status: 201, groupTrip: group };
}

// GET /group-trips?destId=&startDate=&endDate= -- destination is a hard
// filter (§11), dates/status narrow further. Only genuinely discoverable
// groups (open/forming) show up here by default.
export async function listGroupTrips({ destId, startDate, endDate, status, limit = 30, skip = 0 } = {}, models = {}) {
  const { GroupTripModel } = models;
  if (!destId) return { success: false, status: 400, message: "destId query param required" };
  if (!getDestination(destId)) return { success: false, status: 400, message: "unknown destId" };

  const filter = { destId, status: status ? status : { $in: ["open", "forming"] } };
  if (startDate && isValidDate(startDate)) filter.endDate = { $gte: new Date(startDate) };
  if (endDate && isValidDate(endDate)) filter.startDate = { ...(filter.startDate || {}), $lte: new Date(endDate) };

  const groups = await GroupTripModel.find(filter).sort({ startDate: 1 }).skip(skip).limit(limit).lean();
  return { success: true, status: 200, groupTrips: groups };
}

export async function getGroupTrip(groupTripId, models = {}) {
  const { GroupTripModel } = models;
  const group = await GroupTripModel.findById(groupTripId).lean();
  if (!group) return { success: false, status: 404, message: "group trip not found" };
  return { success: true, status: 200, groupTrip: group };
}

export async function getMyGroupTrips(userId, models = {}) {
  const { GroupTripMemberModel, GroupTripModel } = models;
  const memberships = await GroupTripMemberModel.find({ userId, status: { $in: ["requested", "accepted"] } }).lean();
  if (memberships.length === 0) return { success: true, status: 200, groupTrips: [] };

  const groupIds = memberships.map((m) => m.groupTripId);
  const groups = await GroupTripModel.find({ _id: { $in: groupIds } }).sort({ startDate: 1 }).lean();
  const membershipByGroup = new Map(memberships.map((m) => [String(m.groupTripId), m]));
  const groupTrips = groups.map((g) => ({ ...g, myMembership: membershipByGroup.get(String(g._id)) }));
  return { success: true, status: 200, groupTrips };
}

// Creator-only, limited fields -- never destId (§5: the backend never
// silently rewrites a group's destination) or maxMembers below
// currentMembers (would make the group over-capacity by definition).
const UPDATABLE_FIELDS = ["itinerary", "announcements", "status", "captainId", "maxMembers"];
export async function updateGroupTrip(groupTripId, actorId, data, models = {}) {
  const { GroupTripModel } = models;
  const group = await GroupTripModel.findById(groupTripId);
  if (!group) return { success: false, status: 404, message: "group trip not found" };
  if (String(group.creatorId) !== String(actorId)) {
    return { success: false, status: 403, message: "only the creator can update this group" };
  }

  const update = {};
  for (const field of UPDATABLE_FIELDS) {
    if (data[field] !== undefined) update[field] = data[field];
  }
  if (update.maxMembers !== undefined && update.maxMembers < group.currentMembers) {
    return { success: false, status: 400, message: "maxMembers cannot be set below the current member count" };
  }
  if (update.status !== undefined && !["draft", "open", "forming", "confirmed", "active", "completed", "cancelled"].includes(update.status)) {
    return { success: false, status: 400, message: "invalid status" };
  }
  if (Object.keys(update).length === 0) {
    return { success: false, status: 400, message: "no updatable fields supplied" };
  }

  Object.assign(group, update);
  await group.save();
  return { success: true, status: 200, groupTrip: group };
}

export async function getGroupMembers(groupTripId, models = {}) {
  const { GroupTripMemberModel } = models;
  const members = await GroupTripMemberModel.find({ groupTripId, status: { $in: ["accepted", "requested"] } })
    .populate({ path: "userId", select: "fullName profilePhoto" })
    .lean();
  return { success: true, status: 200, members };
}

// POST /group-trips/:id/join. joinPolicy "open" auto-accepts atomically
// (same capacity guard as acceptMember below); "request" creates a
// pending row for the creator to act on.
export async function joinGroupTrip(groupTripId, userId, models = {}, { sendMailFn } = {}) {
  const { GroupTripModel, GroupTripMemberModel, UserModel } = models;
  const group = await GroupTripModel.findById(groupTripId);
  if (!group) return { success: false, status: 404, message: "group trip not found" };
  if (!["open", "forming"].includes(group.status)) {
    return { success: false, status: 400, message: "this group is not currently accepting new members" };
  }
  if (String(group.creatorId) === String(userId)) {
    return { success: false, status: 400, message: "you already created this group" };
  }

  const existing = await GroupTripMemberModel.findOne({ groupTripId, userId });
  if (existing && ["requested", "accepted"].includes(existing.status)) {
    return { success: false, status: 409, message: "you already have an active request or membership for this group" };
  }

  const requester = UserModel ? await UserModel.findById(userId).select("preferences fullName") : null;
  const { factors, reasons } = computeMatchFactors(group, requester?.preferences || {}, { startDate: group.startDate, endDate: group.endDate });

  if (group.joinPolicy === "open") {
    const updatedGroup = await GroupTripModel.findOneAndUpdate(
      { _id: groupTripId, $expr: { $lt: ["$currentMembers", "$maxMembers"] } },
      { $inc: { currentMembers: 1 } },
      { new: true }
    );
    if (!updatedGroup) return { success: false, status: 409, message: "group is full" };

    const member = await GroupTripMemberModel.findOneAndUpdate(
      { groupTripId, userId },
      { $set: { role: "member", status: "accepted", matchFactors: factors, matchReasons: reasons, joinedAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return { success: true, status: 200, member, autoAccepted: true };
  }

  const member = await GroupTripMemberModel.findOneAndUpdate(
    { groupTripId, userId },
    { $set: { role: "member", status: "requested", matchFactors: factors, matchReasons: reasons } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Best-effort email to the creator -- never blocks the response, same
  // fire-and-forget convention as every other lifecycle email here.
  if (sendMailFn && UserModel) {
    UserModel.findById(group.creatorId).select("email fullName").then((creator) => {
      if (!creator) return;
      return sendMailFn(creator.email, creator.fullName, requester?.fullName || "A traveller", group);
    }).catch(() => {});
  }

  return { success: true, status: 200, member, autoAccepted: false };
}

export async function leaveGroupTrip(groupTripId, userId, models = {}) {
  const { GroupTripModel, GroupTripMemberModel } = models;
  const group = await GroupTripModel.findById(groupTripId);
  if (!group) return { success: false, status: 404, message: "group trip not found" };
  if (String(group.creatorId) === String(userId)) {
    return { success: false, status: 400, message: "the creator cannot leave their own group -- cancel it instead" };
  }

  const member = await GroupTripMemberModel.findOneAndUpdate(
    { groupTripId, userId, status: "accepted" },
    { $set: { status: "left" } },
    { new: true }
  );
  if (!member) return { success: false, status: 404, message: "you are not an active member of this group" };

  await GroupTripModel.updateOne(
    { _id: groupTripId, currentMembers: { $gt: 0 } },
    { $inc: { currentMembers: -1 } }
  );
  if (String(group.captainId) === String(userId)) {
    await GroupTripModel.updateOne({ _id: groupTripId }, { $set: { captainId: null } });
  }
  return { success: true, status: 200 };
}

// Creator-only. Atomic capacity guard: only succeeds if currentMembers <
// maxMembers right now (§19: "never read currentMembers, increment in
// application code, and save"). If the member-row flip then fails to find
// a matching "requested" row (already handled by a concurrent request),
// the increment is rolled back so capacity never leaks.
export async function acceptMember(groupTripId, targetUserId, actorId, models = {}, { sendMailFn } = {}) {
  const { GroupTripModel, GroupTripMemberModel, UserModel } = models;
  const group = await GroupTripModel.findById(groupTripId);
  if (!group) return { success: false, status: 404, message: "group trip not found" };
  if (String(group.creatorId) !== String(actorId)) {
    return { success: false, status: 403, message: "only the creator can accept members" };
  }

  const updatedGroup = await GroupTripModel.findOneAndUpdate(
    { _id: groupTripId, $expr: { $lt: ["$currentMembers", "$maxMembers"] } },
    { $inc: { currentMembers: 1 } },
    { new: true }
  );
  if (!updatedGroup) return { success: false, status: 409, message: "group is full" };

  const member = await GroupTripMemberModel.findOneAndUpdate(
    { groupTripId, userId: targetUserId, status: "requested" },
    { $set: { status: "accepted", joinedAt: new Date() } },
    { new: true }
  );
  if (!member) {
    await GroupTripModel.updateOne({ _id: groupTripId }, { $inc: { currentMembers: -1 } });
    return { success: false, status: 404, message: "no pending request found for this user" };
  }

  if (updatedGroup.currentMembers >= updatedGroup.maxMembers) {
    await GroupTripModel.updateOne({ _id: groupTripId, status: "open" }, { $set: { status: "forming" } });
  }

  if (sendMailFn && UserModel) {
    UserModel.findById(targetUserId).select("email fullName").then((user) => {
      if (!user) return;
      return sendMailFn(user.email, user.fullName, true, group);
    }).catch(() => {});
  }

  return { success: true, status: 200, member };
}

export async function rejectMember(groupTripId, targetUserId, actorId, models = {}, { sendMailFn } = {}) {
  const { GroupTripModel, GroupTripMemberModel, UserModel } = models;
  const group = await GroupTripModel.findById(groupTripId);
  if (!group) return { success: false, status: 404, message: "group trip not found" };
  if (String(group.creatorId) !== String(actorId)) {
    return { success: false, status: 403, message: "only the creator can reject members" };
  }

  const member = await GroupTripMemberModel.findOneAndUpdate(
    { groupTripId, userId: targetUserId, status: "requested" },
    { $set: { status: "rejected" } },
    { new: true }
  );
  if (!member) return { success: false, status: 404, message: "no pending request found for this user" };

  if (sendMailFn && UserModel) {
    UserModel.findById(targetUserId).select("email fullName").then((user) => {
      if (!user) return;
      return sendMailFn(user.email, user.fullName, false, group);
    }).catch(() => {});
  }

  return { success: true, status: 200, member };
}

// GET /group-trips/:id/matches -- explainable match reasons for the
// requesting user against this specific group (used by both the group
// detail page and the AI's get_group_match_reasons tool).
export async function getGroupMatchReasons(groupTripId, userId, models = {}) {
  const { GroupTripModel, UserModel } = models;
  const group = await GroupTripModel.findById(groupTripId).lean();
  if (!group) return { success: false, status: 404, message: "group trip not found" };
  const user = await UserModel.findById(userId).select("preferences");
  if (!user) return { success: false, status: 404, message: "user not found" };

  const { factors, reasons } = computeMatchFactors(group, user.preferences || {}, { startDate: group.startDate, endDate: group.endDate });
  return { success: true, status: 200, factors, reasons };
}

// search_group_trips's backing search: destId hard filter, ranked
// internally by match score but the response only ever carries booleans/
// reasons per group, never the numeric score itself (§12).
export async function searchGroupMatches(userId, { destId, startDate, endDate, limit = 20 } = {}, models = {}) {
  const { GroupTripModel, UserModel } = models;
  if (!destId) return { success: false, status: 400, message: "destId query param required" };
  if (!getDestination(destId)) return { success: false, status: 400, message: "unknown destId" };

  const user = await UserModel.findById(userId).select("preferences");
  if (!user) return { success: false, status: 404, message: "user not found" };

  const filter = { destId, status: { $in: ["open", "forming"] } };
  const groups = await GroupTripModel.find(filter).limit(100).lean();

  const dateRange = startDate && endDate ? { startDate, endDate } : null;
  const ranked = groups
    .map((g) => ({ groupTrip: g, ...computeMatchFactors(g, user.preferences || {}, dateRange) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ groupTrip, factors, reasons }) => ({ groupTrip, factors, reasons }));

  return { success: true, status: 200, matches: ranked };
}
