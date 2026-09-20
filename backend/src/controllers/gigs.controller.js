import WorkerProfile from "../models/workerProfile.model.js";
import GigRequest from "../models/gigRequest.model.js";
import GigMatch from "../models/gigMatch.model.js";
import {
  listOpenGigs,
  createGigRequest,
  acceptGig,
  completeGig,
  rateGig,
  getOperatorGigs,
} from "../services/gigs/gigService.js";
import { parsePagination } from "../lib/pagination.js";

const models = { WorkerProfileModel: WorkerProfile, GigRequestModel: GigRequest, GigMatchModel: GigMatch };

// GET /api/v1/gigs?destId&skill -- browse open gigs nearby (spec §04's
// "browse second" half; worker-only, matching the spec's own Actor column).
export const listGigsController = async (req, res) => {
  try {
    const { destId, skill } = req.query;
    const { limit, skip } = parsePagination(req.query);
    const gigs = await listOpenGigs({ destId, skill, limit, skip }, models);
    res.status(200).json(gigs);
  } catch (error) {
    console.log("Error in listGigs controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// POST /api/v1/gigs -- operator posts a gig request, which immediately
// fans out GigMatch "offered" rows to every matching, available worker
// (push-first, spec §04). Response shape {gigRequest, notified} mirrors
// the existing POST /v1/offers -> {offer, notified} convention.
export const createGigController = async (req, res) => {
  try {
    if (req.user.role !== "operator") {
      return res.status(403).json({ message: "operator role required" });
    }
    const result = await createGigRequest(req.user._id, req.body, models);
    if (!result.success) return res.status(result.status).json({ message: result.message });
    res.status(201).json({ gigRequest: result.gigRequest, notified: result.matchCount });
  } catch (error) {
    console.log("Error in createGig controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// POST /api/v1/gigs/:id/accept -- worker claims an offered gig. Atomic:
// see gigService.acceptGig's own header comment.
export const acceptGigController = async (req, res) => {
  try {
    if (req.user.role !== "worker") {
      return res.status(403).json({ message: "worker role required" });
    }
    const result = await acceptGig(req.params.id, req.user._id, models);
    res.status(result.status).json(result.success ? { success: true, match: result.match } : { message: result.message });
  } catch (error) {
    console.log("Error in acceptGig controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// POST /api/v1/gigs/:id/complete -- either side marks the gig done.
export const completeGigController = async (req, res) => {
  try {
    if (!["worker", "operator"].includes(req.user.role)) {
      return res.status(403).json({ message: "worker or operator role required" });
    }
    const result = await completeGig(req.params.id, req.user._id, req.user.role, models);
    res.status(result.status).json(result.success ? result : { message: result.message });
  } catch (error) {
    console.log("Error in completeGig controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// POST /api/v1/gigs/:id/rate  { score, comment } -- either side rates the
// other, 1-5, after the gig is marked complete.
export const rateGigController = async (req, res) => {
  try {
    if (!["worker", "operator"].includes(req.user.role)) {
      return res.status(403).json({ message: "worker or operator role required" });
    }
    const result = await rateGig(req.params.id, req.user._id, req.user.role, req.body, models);
    res.status(result.status).json(result.success ? result : { message: result.message });
  } catch (error) {
    console.log("Error in rateGig controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// GET /api/v1/operators/me/gigs -- operator tracks their own posted gigs.
export const getMyPostedGigsController = async (req, res) => {
  try {
    if (req.user.role !== "operator") {
      return res.status(403).json({ message: "operator role required" });
    }
    const gigs = await getOperatorGigs(req.user._id, models);
    res.status(200).json(gigs);
  } catch (error) {
    console.log("Error in getMyPostedGigs controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
