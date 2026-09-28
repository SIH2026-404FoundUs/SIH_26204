import WorkerProfile from "../models/workerProfile.model.js";
import GigRequest from "../models/gigRequest.model.js";
import GigMatch from "../models/gigMatch.model.js";
import {
  createOrUpdateWorkerProfile,
  updateWorkerAvailability,
  getWorkerProfileByUserId,
  getWorkerGigs,
} from "../services/gigs/gigService.js";
import { logger } from "../lib/logger.js";

const models = { WorkerProfileModel: WorkerProfile, GigRequestModel: GigRequest, GigMatchModel: GigMatch };

// POST /api/v1/workers -- create-or-update this worker's own profile
// (skills, service area, rate expectation, languages). Same shape as
// registerBusinessController for an operator: one form, whitelisted fields
// only, never a spread of req.body.
export const upsertWorkerProfileController = async (req, res) => {
  try {
    const result = await createOrUpdateWorkerProfile(req.user._id, req.body, models);
    res.status(result.status).json(result.success ? result.profile : { message: result.message });
  } catch (error) {
    logger.error("Error in upsertWorkerProfile controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// GET /api/v1/workers/me -- this worker's own profile, so the app can tell
// "no profile yet" (onboarding gate) from "profile exists, still loading".
export const getMyWorkerProfileController = async (req, res) => {
  try {
    const profile = await getWorkerProfileByUserId(req.user._id, models);
    if (!profile) return res.status(404).json({ message: "no worker profile yet" });
    res.status(200).json(profile);
  } catch (error) {
    logger.error("Error in getMyWorkerProfile controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// PATCH /api/v1/workers/me/availability -- toggle "free now" or set
// scheduled windows, without touching skills/rate/anything else.
export const updateAvailabilityController = async (req, res) => {
  try {
    const result = await updateWorkerAvailability(req.user._id, req.body, models);
    res.status(result.status).json(result.success ? result.profile : { message: result.message });
  } catch (error) {
    logger.error("Error in updateAvailability controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// GET /api/v1/workers/me/gigs -- "My Jobs" (spec §06): every gig this
// worker has ever been offered/accepted/completed, across all statuses.
// Additive beyond the spec's literal API table -- see gigService.js's own
// comment on getWorkerGigs for why this had to exist for that screen.
export const getMyGigsController = async (req, res) => {
  try {
    const rows = await getWorkerGigs(req.user._id, models);
    res.status(200).json(rows);
  } catch (error) {
    logger.error("Error in getMyGigs controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
