// Authority dashboard — Redistribution Impact + Acceptance Rate sections.
// Both read the same `trips` collection, so one aggregation pipeline backs
// both dashboard endpoints (dashboard.controller.js) instead of running the
// query twice per request.
//
// This is a separate aggregation from trips.controller.js's own
// getTripsSummaryController, which stays untouched -- that endpoint already
// ships (GET /api/v1/trips/summary, unauthenticated, an older/simpler
// shape used elsewhere) and this task's brief is additive dashboard work,
// not a refactor of working code. The two overlap in what they count but
// answer different shapes (this one adds the redistribution byDestination
// breakdown and average pressure relief the dashboard spec asks for, and is
// gated behind requireRole("authority") at the route layer).
//
// Field semantics are locked by trip.model.js and must not be reinterpreted
// here:
//   - a trip counts as "redirected" only when redistribution.kind !== "none"
//   - "an alternative was offered" is the separate alternativesOffered flag
//   - acceptanceRate = count(redistribution.kind != "none") / count(alternativesOffered == true)
//     -- NOT accepted/totalTrips, and NOT restricted to only the trips that
//     were both offered and accepted. Divide-by-zero returns null, matching
//     this project's existing "null, not a fabricated 0, when there's no
//     data" convention (see getTripsSummaryController's acceptanceRate).
import Trip from "../../models/trip.model.js";
import { getDestination } from "../pressure/seed.js";

export async function computeTripsAnalytics() {
  const [totals] = await Trip.aggregate([
    {
      $group: {
        _id: null,
        totalTrips: { $sum: 1 },
        redirectedPlace: { $sum: { $cond: [{ $eq: ["$redistribution.kind", "place"] }, 1, 0] } },
        redirectedDate: { $sum: { $cond: [{ $eq: ["$redistribution.kind", "date"] }, 1, 0] } },
        alternativesOffered: { $sum: { $cond: [{ $eq: ["$alternativesOffered", true] }, 1, 0] } },
        totalBudgetINRMoved: {
          $sum: { $cond: [{ $ne: ["$redistribution.kind", "none"] }, { $ifNull: ["$budgetINR", 0] }, 0] },
        },
        // Average of (pressureBefore - pressureAfter) across redirected trips
        // that actually recorded both readings -- a trip redirected before
        // this pair was captured contributes nothing rather than a fake 0.
        reliefSum: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ["$redistribution.kind", "none"] },
                  { $ne: ["$redistribution.pressureBefore", null] },
                  { $ne: ["$redistribution.pressureAfter", null] },
                ],
              },
              { $subtract: ["$redistribution.pressureBefore", "$redistribution.pressureAfter"] },
              0,
            ],
          },
        },
        reliefCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ["$redistribution.kind", "none"] },
                  { $ne: ["$redistribution.pressureBefore", null] },
                  { $ne: ["$redistribution.pressureAfter", null] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  const byDestinationRaw = await Trip.aggregate([
    { $match: { "redistribution.kind": { $ne: "none" }, redirectedToDestId: { $ne: null } } },
    { $group: { _id: "$redirectedToDestId", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  const redirectedTrips = (totals?.redirectedPlace || 0) + (totals?.redirectedDate || 0);
  const alternativesOffered = totals?.alternativesOffered || 0;

  return {
    redirectedTrips,
    totalBudgetMovedINR: totals?.totalBudgetINRMoved || 0,
    // null, not 0, when nothing has a before/after pair yet -- an honest
    // "unavailable" rather than a fabricated relief figure.
    averagePressureRelief: totals?.reliefCount ? Number((totals.reliefSum / totals.reliefCount).toFixed(3)) : null,
    byDestination: byDestinationRaw.map((row) => ({
      destId: row._id,
      displayName: getDestination(row._id)?.displayName ?? row._id,
      count: row.count,
    })),
    // Acceptance rate inputs, kept alongside the ratio itself so the
    // frontend can always show the denominator next to the percentage
    // (dashboard spec: "This denominator MUST be visible").
    accepted: redirectedTrips,
    alternativesOffered,
    acceptanceRate: alternativesOffered > 0 ? Number((redirectedTrips / alternativesOffered).toFixed(3)) : null,
    totalTrips: totals?.totalTrips || 0,
  };
}
