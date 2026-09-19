import express from "express";
import { ok, fail } from "../lib/envelope.js";
import { loadDestinations } from "../services/pressure/seed.js";

const router = express.Router();

/**
 * GET /api/destinations
 * Returns list of all tracked destinations enriched with coordinates, state, and baseline metrics.
 */
router.get("/", (req, res) => {
  try {
    const destinations = loadDestinations().map((d) => ({
      _id: d._id,
      id: d._id,
      displayName: d.displayName,
      googlePlaceId: d.googlePlaceId || null,
      state: d.state,
      location: d.location || { lat: 20.5937, lng: 78.9629 },
      attrs: d.attrs || {},
      baseline: d.baseline || null,
      expectedSupply: d.expectedSupply || null,
      // Access context the seed has always carried but this projection used
      // to drop, so the planner could not tell a traveller how they would
      // actually reach the place. All seeded, no provider call needed.
      nearestRailhead: d.nearestRailhead || null,
      railheadDistanceKm: d.railheadDistanceKm ?? null,
      nearestAirport: d.nearestAirport || null,
      roadAccess: d.roadAccess || null
    }));

    res.json(ok(destinations, { count: destinations.length }));
  } catch (error) {
    res.status(500).json(fail("Failed to retrieve destinations", { error: error.message }));
  }
});

export default router;
