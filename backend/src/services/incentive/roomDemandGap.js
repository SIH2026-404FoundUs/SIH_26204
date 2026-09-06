// Incentive Engine — bharani-tasks.md Section 2.3 (Feature 9: Digital
// Passport & Vacancy Matching)
//
// roomDemandGap = estimatedRooms - sum(business_availability.units.available
//                                        for that destId/date)
//
// This is a RAW room count, not Sathvik's pressure engine's `capacityGap` —
// that field is a different, normalised 0..1 quantity computed elsewhere.
// Two different formulas sharing one name is how someone reads the wrong
// number off a dashboard three days before the demo, so this field is named
// roomDemandGap everywhere, on purpose, and must never be renamed to
// capacityGap in this file or in anything that shapes its response.

import Business from "../../models/business.model.js";
import BusinessAvailability from "../../models/businessAvailability.model.js";

/**
 * Computes the room demand gap for one destination/date: how many more rooms
 * travellers are estimated to want than businesses in that destination have
 * declared available, summed across every business at that destId regardless
 * of resourceType (matching the bharani-tasks.md formula, which sums
 * `units.available` unconditionally).
 *
 * BUSINESS_AVAILABILITY rows don't carry destId directly — only businessId —
 * so this resolves destId -> the businesses at that destination first, then
 * sums their availability rows for the given date.
 *
 * @param {string} destId - Canonical destination slug (DESTINATIONS._id).
 * @param {string|Date} date - Must match how BUSINESS_AVAILABILITY.date is stored.
 * @param {number} estimatedRooms - From that destId/date's DESTINATION_DEMAND row.
 * @returns {Promise<{ destId: string, date: string|Date, estimatedRooms: number,
 *   availableRooms: number, roomDemandGap: number }>}
 */
export async function roomDemandGap(destId, date, estimatedRooms) {
  const businesses = await Business.find({ destId }).select("_id").lean();
  const businessIds = businesses.map((b) => b._id);

  let availableRooms = 0;
  if (businessIds.length > 0) {
    const rows = await BusinessAvailability.find({
      businessId: { $in: businessIds },
      date,
    }).lean();
    availableRooms = rows.reduce((sum, row) => sum + (Number(row.units?.available) || 0), 0);
  }

  const demand = Number(estimatedRooms) || 0;

  return {
    destId,
    date,
    estimatedRooms: demand,
    availableRooms,
    roomDemandGap: demand - availableRooms,
  };
}
