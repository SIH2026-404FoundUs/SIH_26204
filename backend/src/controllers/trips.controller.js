import mongoose from "mongoose";
import Trip from "../models/trip.model.js";
import { saveOfferedAlternatives, markAcceptedAlternative } from "../services/alternatives/alternativeSuggestions.js";

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
    console.log("Error in createTrip controller", error.message);
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
    console.log("Error in listTrips controller", error.message);
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
    const [totals] = await Trip.aggregate([
      {
        $group: {
          _id: null,
          totalTrips: { $sum: 1 },
          redirectedPlace: { $sum: { $cond: [{ $eq: ["$redistribution.kind", "place"] }, 1, 0] } },
          redirectedDate: { $sum: { $cond: [{ $eq: ["$redistribution.kind", "date"] }, 1, 0] } },
          declined: { $sum: { $cond: [{ $eq: ["$redistribution.kind", "none"] }, 1, 0] } },
          totalSavingINR: { $sum: { $ifNull: ["$redistribution.savingINR", 0] } },
          // "Budget moved" = the traveller's own declared budgetINR for every
          // trip that was actually redirected (place or date), not the
          // saving amount -- a distinct figure from totalSavingINR above.
          totalBudgetINRMoved: {
            $sum: {
              $cond: [{ $ne: ["$redistribution.kind", "none"] }, { $ifNull: ["$budgetINR", 0] }, 0],
            },
          },
        },
      },
    ]);

    const totalTrips = totals?.totalTrips || 0;
    const redirected = (totals?.redirectedPlace || 0) + (totals?.redirectedDate || 0);

    res.status(200).json({
      totalTrips,
      redirectedPlace: totals?.redirectedPlace || 0,
      redirectedDate: totals?.redirectedDate || 0,
      declined: totals?.declined || 0,
      // Share of all trips where the traveller took the offered relief.
      // null (not 0) when there is no data yet -- an honest "unavailable",
      // not a fabricated zero.
      acceptanceRate: totalTrips > 0 ? Number((redirected / totalTrips).toFixed(3)) : null,
      totalSavingINR: totals?.totalSavingINR || 0,
      totalBudgetINRMoved: totals?.totalBudgetINRMoved || 0,
    });
  } catch (error) {
    console.log("Error in getTripsSummary controller", error.message);
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
    console.log("Error in updateTrip controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
