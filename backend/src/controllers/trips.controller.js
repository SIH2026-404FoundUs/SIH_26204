import mongoose from "mongoose";
import Trip from "../models/trip.model.js";

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
    if (!userId || !requestedDestId) {
      return res.status(400).json({ message: "userId and requestedDestId are required" });
    }
    const trip = await Trip.create({
      userId, origin, requestedDestId, requestedDates, travellers, budgetINR, interests,
      _draftPressure, _draftAlternatives,
      state: "draft",
    });
    res.status(201).json(trip);
  } catch (error) {
    console.log("Error in createTrip controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// GET /api/v1/trips/:id
export const getTripController = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ message: "invalid trip id" });
    }
    const trip = await Trip.findById(req.params.id).lean();
    if (!trip) return res.status(404).json({ message: "trip not found" });
    res.status(200).json(trip);
  } catch (error) {
    console.log("Error in getTrip controller", error.message);
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
    const trip = await Trip.findByIdAndUpdate(req.params.id, { $set: update }, { new: true });
    if (!trip) return res.status(404).json({ message: "trip not found" });
    res.status(200).json(trip);
  } catch (error) {
    console.log("Error in updateTrip controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
