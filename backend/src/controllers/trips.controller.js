import mongoose from "mongoose";
import Trip from "../models/trip.model.js";
import { saveOfferedAlternatives, markAcceptedAlternative } from "../services/alternatives/alternativeSuggestions.js";
import { logger } from "../lib/logger.js";
import { getTripsSummary } from "../services/trips/tripSummaryService.js";

// A malformed :id (not a 24-char hex ObjectId) makes Mongoose throw a CastError
// -- caller error, not a server fault -- so both handlers below check this
// first and return 400 rather than letting the catch-all turn it into a 500.
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// POST /api/v1/trips — create a trip record (spec §6). Called by ai-service's
// orchestrator when pressure-gating pauses a plan to offer alternatives, so the
// draft exists as a real document from the first request rather than only
// materializing once a plan completes.
export const createTripController = async (req, res) => {
  try {
    const {
      userId, origin, requestedDestId, requestedDates, travellers, budgetINR, interests,
      _draftPressure, _draftAlternatives,
    } = req.body;
    const ownerId = req.isInternalService ? userId : String(req.user._id);
    if (!ownerId || !requestedDestId) {
      return res.status(400).json({ message: "userId and requestedDestId are required" });
    }
    const trip = await Trip.create({
      userId: ownerId, origin, requestedDestId, requestedDates, travellers, budgetINR, interests,
      _draftPressure, _draftAlternatives,
      state: "draft",
    });
    // Best-effort, never blocks the response: the trip itself is already
    // saved and is what /confirm actually depends on.
    saveOfferedAlternatives(trip, _draftAlternatives).catch(() => {});
    res.status(201).json(trip);
  } catch (error) {
    logger.error("Error in createTrip controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// GET /api/v1/trips?userId= — the traveller's own trip history (My Trips).
// Not part of the locked §6 contract's original endpoint list, but needed for
// the frontend's My Trips page to be real rather than a "coming soon" stub --
// everything it reads (createdAt, requestedDestId, redistribution.kind) was
// already in the schema.
export const listTripsController = async (req, res) => {
  try {
    const userId = req.isInternalService ? req.query.userId : String(req.user._id);
    if (!userId) return res.status(400).json({ message: "userId query param required" });
    const trips = await Trip.find({ userId }).sort({ createdAt: -1 }).lean();
    res.status(200).json(trips);
  } catch (error) {
    logger.error("Error in listTrips controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// GET /api/v1/trips/summary — authority-dashboard aggregate (frontend sitemap
// doc, Page 11: "the query logic is a few lines once real trip records exist
// to aggregate"). Now that they do, ship the real numbers instead of a
// "coming soon" panel -- but only the numbers this schema can actually
// support honestly; no capacity-gap table here, since that needs a
// destinations collection this project still doesn't have.
export const getTripsSummaryController = async (req, res) => {
  try {
    res.status(200).json(await getTripsSummary());
  } catch (error) {
    logger.error("Error in getTripsSummary controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// GET /api/v1/trips/:id
export const getTripController = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ message: "invalid trip id" });
    }
    const query = req.isInternalService
      ? { _id: req.params.id }
      : { _id: req.params.id, userId: String(req.user._id) };
    const trip = await Trip.findOne(query).lean();
    if (!trip) return res.status(404).json({ message: "trip not found" });
    res.status(200).json(trip);
  } catch (error) {
    logger.error("Error in getTrip controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// PATCH /api/v1/trips/:id — used on confirm/decline to attach the redirect
// decision, itinerary, cost breakdown, and redistribution record.
export const updateTripController = async (req, res) => {
  try {
    const allowed = [
      "redirectedToDestId", "finalDates", "selectedHotel", "stops", "itinerary",
      "transport", "costBreakdown", "redistribution", "alternativesOffered",
      "shareToken", "state",
    ];
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ message: "invalid trip id" });
    }
    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    const query = req.isInternalService
      ? { _id: req.params.id }
      : { _id: req.params.id, userId: String(req.user._id) };
    const trip = await Trip.findOneAndUpdate(query, { $set: update }, { new: true });
    if (!trip) return res.status(404).json({ message: "trip not found" });
    if (update.redistribution) {
      // Best-effort, never blocks the response -- same reasoning as the
      // create-side save above.
      markAcceptedAlternative(trip).catch(() => {});
    }
    res.status(200).json(trip);
  } catch (error) {
    logger.error("Error in updateTrip controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
