import GroupTrip from "../models/groupTrip.model.js";
import GroupTripMember from "../models/groupTripMember.model.js";
import User from "../models/user.model.js";
import GigRequest from "../models/gigRequest.model.js";
import GigMatch from "../models/gigMatch.model.js";
import WorkerProfile from "../models/workerProfile.model.js";
import {
  createGroupTrip,
  listGroupTrips,
  getGroupTrip,
  updateGroupTrip,
  getGroupMembers,
  joinGroupTrip,
  leaveGroupTrip,
  acceptMember,
  rejectMember,
  getMyGroupTrips,
  getGroupMatchReasons,
  searchGroupMatches,
} from "../services/groups/groupTripService.js";
import { requestCaptainForGroup } from "../services/groups/captainService.js";
import { sendMail } from "../lib/mailer.js";
import { groupJoinRequestEmail, groupJoinDecisionEmail } from "../lib/emailTemplates.js";
import { parsePagination } from "../lib/pagination.js";
import { logger } from "../lib/logger.js";

const models = { GroupTripModel: GroupTrip, GroupTripMemberModel: GroupTripMember, UserModel: User };
const captainModels = { GroupTripModel: GroupTrip, GigRequestModel: GigRequest, GigMatchModel: GigMatch, WorkerProfileModel: WorkerProfile };
const APP_URL = (process.env.CLIENT_URL || "http://localhost:5173").split(",")[0].trim();

const sendJoinRequestMail = (to, fullName, requesterName, group) =>
  sendMail({ to, ...groupJoinRequestEmail({ fullName, requesterName, destId: group.destId, appUrl: APP_URL, groupTripId: group._id }) });

const sendJoinDecisionMail = (to, fullName, accepted, group) =>
  sendMail({ to, ...groupJoinDecisionEmail({ fullName, destId: group.destId, accepted, appUrl: APP_URL, groupTripId: group._id }) });

function respond(res, result, okBody) {
  res.status(result.status).json(result.success ? (okBody ? okBody(result) : result) : { message: result.message });
}

// Same convention as trips.controller.js: a browser session supplies its
// own req.user; an internal service call (ai-service's SequentialAgent
// tools) must name WHOSE preferences/membership it's acting for explicitly
// -- never implicitly trusted, since there's no session to derive it from.
function resolveUserId(req) {
  if (!req.isInternalService) return String(req.user._id);
  return req.body?.userId || req.query?.userId || null;
}

// POST /api/v1/group-trips
export const createGroupTripController = async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(400).json({ message: "userId is required" });
    const result = await createGroupTrip(userId, req.body, models);
    respond(res, result);
  } catch (error) {
    logger.error("Error in createGroupTrip controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// GET /api/v1/group-trips?destId=&startDate=&endDate=&status=
export const listGroupTripsController = async (req, res) => {
  try {
    const { destId, startDate, endDate, status } = req.query;
    const { limit, skip } = parsePagination(req.query, { defaultLimit: 30 });
    const result = await listGroupTrips({ destId, startDate, endDate, status, limit, skip }, models);
    respond(res, result);
  } catch (error) {
    logger.error("Error in listGroupTrips controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// GET /api/v1/group-trips/me -- MUST be registered before /:id in the router
export const getMyGroupTripsController = async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(400).json({ message: "userId is required" });
    const result = await getMyGroupTrips(userId, models);
    respond(res, result);
  } catch (error) {
    logger.error("Error in getMyGroupTrips controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// GET /api/v1/group-trips/:id
export const getGroupTripController = async (req, res) => {
  try {
    const result = await getGroupTrip(req.params.id, models);
    respond(res, result);
  } catch (error) {
    logger.error("Error in getGroupTrip controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// PATCH /api/v1/group-trips/:id -- creator-only
export const updateGroupTripController = async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(400).json({ message: "userId is required" });
    const result = await updateGroupTrip(req.params.id, userId, req.body, models);
    respond(res, result);
  } catch (error) {
    logger.error("Error in updateGroupTrip controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// GET /api/v1/group-trips/:id/members
export const getGroupMembersController = async (req, res) => {
  try {
    const result = await getGroupMembers(req.params.id, models);
    respond(res, result);
  } catch (error) {
    logger.error("Error in getGroupMembers controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// POST /api/v1/group-trips/:id/join
export const joinGroupTripController = async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(400).json({ message: "userId is required" });
    const result = await joinGroupTrip(req.params.id, userId, models, { sendMailFn: sendJoinRequestMail });
    respond(res, result);
  } catch (error) {
    logger.error("Error in joinGroupTrip controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// POST /api/v1/group-trips/:id/leave
export const leaveGroupTripController = async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(400).json({ message: "userId is required" });
    const result = await leaveGroupTrip(req.params.id, userId, models);
    respond(res, result);
  } catch (error) {
    logger.error("Error in leaveGroupTrip controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// POST /api/v1/group-trips/:id/members/:userId/accept -- creator-only
export const acceptGroupMemberController = async (req, res) => {
  try {
    const actorId = resolveUserId(req);
    if (!actorId) return res.status(400).json({ message: "userId is required" });
    const result = await acceptMember(req.params.id, req.params.userId, actorId, models, { sendMailFn: sendJoinDecisionMail });
    respond(res, result);
  } catch (error) {
    logger.error("Error in acceptGroupMember controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// POST /api/v1/group-trips/:id/members/:userId/reject -- creator-only
export const rejectGroupMemberController = async (req, res) => {
  try {
    const actorId = resolveUserId(req);
    if (!actorId) return res.status(400).json({ message: "userId is required" });
    const result = await rejectMember(req.params.id, req.params.userId, actorId, models, { sendMailFn: sendJoinDecisionMail });
    respond(res, result);
  } catch (error) {
    logger.error("Error in rejectGroupMember controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// GET /api/v1/group-trips/:id/matches -- the signed-in user's own match
// reasons against this one group (get_group_match_reasons AI tool + the
// group detail page).
export const getGroupMatchReasonsController = async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(400).json({ message: "userId is required" });
    const result = await getGroupMatchReasons(req.params.id, userId, models);
    respond(res, result);
  } catch (error) {
    logger.error("Error in getGroupMatchReasons controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// GET /api/v1/group-trips/search/matches?destId=&startDate=&endDate= --
// ranked (internally) group discovery for the signed-in user's own
// preferences (search_group_trips AI tool + Travel Together > Discover).
export const searchGroupMatchesController = async (req, res) => {
  try {
    const { destId, startDate, endDate } = req.query;
    const userId = resolveUserId(req);
    if (!userId) return res.status(400).json({ message: "userId is required" });
    const result = await searchGroupMatches(userId, { destId, startDate, endDate }, models);
    respond(res, result);
  } catch (error) {
    logger.error("Error in searchGroupMatches controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// POST /api/v1/group-trips/:id/captain -- creator-only, bridges to the
// existing Worker/Gig marketplace (captainService.js).
export const requestCaptainController = async (req, res) => {
  try {
    const { skillNeeded, budget } = req.body;
    const userId = resolveUserId(req);
    if (!userId) return res.status(400).json({ message: "userId is required" });
    const result = await requestCaptainForGroup(req.params.id, userId, { skillNeeded, budget }, captainModels);
    respond(res, result);
  } catch (error) {
    logger.error("Error in requestCaptain controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
