// Worker role design spec §08 -- "Feeding the Pressure Engine". Same shape
// as roomDemandGap.js's own formula (estimatedRooms - availableRooms), one
// door down: a destination under high tourist pressure doesn't just need
// pricing help for hotels, it needs more drivers and guides too. Kept in
// this same file's neighbourhood (services/incentive/) and deliberately
// NOT merged into roomDemandGap.js or renamed to share a field -- two
// different formulas sharing plumbing is how someone reads the wrong number
// off a dashboard, the exact mistake roomDemandGap.js's own header comment
// already warns against for its own metric.

import GigRequest from "../../models/gigRequest.model.js";
import WorkerProfile from "../../models/workerProfile.model.js";

/**
 * Computes the labour demand gap for one destination/date: how many more
 * gig headcount slots are still open than there are workers realistically
 * available to fill them.
 *
 * @param {string} destId - Canonical destination slug.
 * @param {string|Date} date - A single date; a gig "covers" it when
 *   startDate <= date <= endDate.
 * @returns {Promise<{ destId, date, openGigsHeadcount: number,
 *   availableWorkers: number, laborDemandGap: number }>}
 */
export async function laborDemandGap(destId, date) {
  const asOf = new Date(date);

  const openGigs = await GigRequest.find({
    destId,
    status: "open",
    startDate: { $lte: asOf },
    endDate: { $gte: asOf },
  })
    .select("headcount")
    .lean();
  const openGigsHeadcount = openGigs.reduce((sum, g) => sum + (Number(g.headcount) || 0), 0);

  // "Available" here mirrors gigService.js's own isWorkerAvailableFor
  // reasoning: on-call right now, or scheduled for a window that covers
  // this date. Not filtered by skill -- this is a destination-wide labour
  // signal (spec's own table has no skill column), same read as
  // roomDemandGap's destination-wide room count.
  const candidates = await WorkerProfile.find({ serviceAreaDestIds: destId }).select("availability").lean();
  const asOfDateString = asOf.toDateString();
  const availableWorkers = candidates.filter((w) => {
    if (w.availability?.mode === "now") return true;
    const windows = w.availability?.windows || [];
    return windows.some((win) => new Date(win.date).toDateString() === asOfDateString);
  }).length;

  return {
    destId,
    date,
    openGigsHeadcount,
    availableWorkers,
    laborDemandGap: openGigsHeadcount - availableWorkers,
  };
}
