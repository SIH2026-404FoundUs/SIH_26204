// Authority dashboard — Capacity Gap section. Two metrics, deliberately kept
// separate per both the dashboard spec and roomDemandGap.js's own explicit
// design rule (see the header comment there): normalizedCapacityGap is
// Sathvik's pressure-side, normalised 0..1 quantity; roomDemandGap is
// Bharani's supply-side, raw room count. Neither is derived from the other.
//
// Data-availability note (read before changing the null-handling below):
// as of this file's authorship, the `destination_demand` collection has no
// writer anywhere in the codebase (DestinationDemand is referenced only by
// its own model + test), and `business_availability` likewise has no
// documents in the live database, though BusinessAvailability's own model
// exists for when an operator-facing write path ships. Feeding the missing
// side of either formula a silent 0 would produce a number that LOOKS like
// a real gap but is actually just "the other term, unmodified" -- exactly
// the fabricated-analytics failure mode the dashboard spec prohibits. So
// both metrics below are null, per destination, whenever their real input
// is genuinely absent (no matching document), never computed against an
// assumed zero.
import DestinationPressure from "../../models/destinationPressure.model.js";
import DestinationDemand from "../../models/destinationDemand.model.js";
import Business from "../../models/business.model.js";
import BusinessAvailability from "../../models/businessAvailability.model.js";
import { loadDestinations } from "../pressure/seed.js";
import { normalizedCapacityGap, expectedSupplyFor } from "../pressure/engine.js";
import { roomDemandGap as computeRoomDemandGap } from "../incentive/roomDemandGap.js";

// Sum of BusinessAvailability.units.available across every business at a
// destination for one date -- the same join roomDemandGap.js performs
// internally, but exposed here as its own bare number (with a hasData flag)
// since normalizedCapacityGap needs the count and roomDemandGap.js does not
// export one. Deliberately not imported from/shared with that file, per its
// own comment insisting the two metrics never share plumbing.
async function bookableSupplyFor(destId, date) {
  const businesses = await Business.find({ destId }).select("_id").lean();
  const businessIds = businesses.map((b) => b._id);
  if (businessIds.length === 0) return { bookableSupply: 0, hasData: false };

  const rows = await BusinessAvailability.find({ businessId: { $in: businessIds }, date }).lean();
  if (rows.length === 0) return { bookableSupply: 0, hasData: false };

  const bookableSupply = rows.reduce((sum, row) => sum + (Number(row.units?.available) || 0), 0);
  return { bookableSupply, hasData: true };
}

export async function computeCapacityGapForDate(date) {
  const destinations = loadDestinations();
  const pressureRows = await DestinationPressure.find({ date }).lean();
  const pressureByDestId = new Map(pressureRows.map((r) => [r.destId, r]));

  return Promise.all(
    destinations.map(async (dest) => {
      const destId = dest._id;
      const pressureRow = pressureByDestId.get(destId);
      const pressure = pressureRow?.score ?? null;

      const [{ bookableSupply, hasData: hasSupplyData }, demandRow] = await Promise.all([
        bookableSupplyFor(destId, date),
        DestinationDemand.findOne({ destId, date }).lean(),
      ]);

      let capacityGapValue = null;
      if (pressure != null && hasSupplyData) {
        const gap = normalizedCapacityGap(pressure, bookableSupply, expectedSupplyFor(dest));
        capacityGapValue = gap?.normalizedCapacityGap ?? null;
      }

      let roomDemandGapValue = null;
      if (demandRow?.estimatedRooms != null) {
        const result = await computeRoomDemandGap(destId, date, demandRow.estimatedRooms);
        roomDemandGapValue = result.roomDemandGap;
      }

      return {
        destId,
        displayName: dest.displayName ?? dest.name ?? destId,
        normalizedCapacityGap: capacityGapValue,
        roomDemandGap: roomDemandGapValue,
      };
    })
  );
}
