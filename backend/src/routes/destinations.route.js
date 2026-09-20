import express from "express";
import { fail } from "../lib/envelope.js";
import { loadDestinations } from "../services/pressure/seed.js";

const router = express.Router();

/**
 * GET /api/destinations
 * Returns list of all tracked destinations enriched with coordinates, state, and baseline metrics.
 */
router.get("/", (req, res) => {
  try {
    // Read from a file-seeded list (loadDestinations() caches it in memory
    // for the process lifetime already) that only ever changes on a
    // redeploy -- semi-static by definition. Express's default ETag still
    // does the actual 304 work; this just tells the client/CDN it's safe to
    // ask again instead of treating every response as immediately stale.
    res.set("Cache-Control", "public, max-age=300");
    const destinations = loadDestinations().map((d) => ({
      _id: d._id,
      id: d._id,
      displayName: d.displayName,
      googlePlaceId: d.googlePlaceId || null,
      state: d.state,
      // The seed's own shape is flat (lat/lng, attr_*, baseline_*, road_*),
      // never the nested attrs/location/baseline/roadAccess this used to
      // read -- those were always undefined, so every destination silently
      // shipped {} / null / a hardcoded India-center fallback regardless of
      // the real seeded values. Nothing in the frontend reads those fields
      // yet (verified before changing this), so remapping them to the
      // seed's actual field names is pure bug fix, not a behavior change
      // for any existing consumer.
      location: { lat: d.lat ?? 20.5937, lng: d.lng ?? 78.9629 },
      attrs: {
        snow: d.attr_snow ?? null,
        trek: d.attr_trek ?? null,
        riverside: d.attr_riverside ?? null,
        heritage: d.attr_heritage ?? null,
        nightlife: d.attr_nightlife ?? null,
        food: d.attr_food ?? null,
        wildlife: d.attr_wildlife ?? null,
        spiritual: d.attr_spiritual ?? null,
      },
      baseline: {
        railWaitlist: d.baseline_railWL ?? null,
        roadSeatsAvailable: d.baseline_roadSeatsAvail ?? null,
        hotelMedianINR: d.baseline_hotelMedianINR ?? null,
        dailyVisitors: d.baselineDailyVisitors ?? null,
      },
      expectedSupply: d.expectedSupply || null,
      // Access context the seed has always carried but this projection used
      // to drop, so the planner could not tell a traveller how they would
      // actually reach the place. All seeded, no provider call needed.
      nearestRailhead: d.nearestRailhead || null,
      railheadDistanceKm: d.railheadDistanceKm ?? null,
      nearestAirport: d.nearestAirport || null,
      roadAccess: {
        operators: d.road_operators || null,
        corridor: d.road_corridor || null,
        boardingPoint: d.road_boardingPoint || null,
      },
    }));

    // Not ok()'s envelope here on purpose: its meta.fetchedAt defaults to
    // `new Date()`, a value that changes on every single request even
    // though this data doesn't -- baked into the response body, that
    // defeats the ETag/304 the Cache-Control header above exists to make
    // work (verified live: with fetchedAt included, two back-to-back
    // requests for identical data got two different ETags, so a
    // conditional GET never actually 304'd). ok()'s timestamp is honestly
    // meaningful for the live-data providers that use it elsewhere
    // (weather/fare/trains) -- it just doesn't belong on data that's
    // static until the next deploy.
    res.json({ ok: true, data: destinations, meta: { count: destinations.length } });
  } catch (error) {
    res.status(500).json(fail("Failed to retrieve destinations", { error: error.message }));
  }
});

export default router;
