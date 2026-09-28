import Trip from "../../models/trip.model.js";

// Aggregate redistribution numbers across every trip. Kept out of
// trips.controller.js so the controller only deals with HTTP -- this is the
// part that needs a database and a formula, not a request/response.
export async function getTripsSummary({ TripModel = Trip } = {}) {
  const [totals] = await TripModel.aggregate([
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

  return {
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
  };
}
