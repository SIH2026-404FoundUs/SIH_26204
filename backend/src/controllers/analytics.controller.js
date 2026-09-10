import Business from "../models/business.model.js";
import Booking from "../models/booking.model.js";
import Visit from "../models/visit.model.js";
import Waitlist from "../models/waitlist.model.js";
import Offer from "../models/offer.model.js";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// GET /api/v1/analytics/operator — real traveller-activity analytics across
// every business this operator owns (spec: "operator can see analytics of
// different travellers"). Every number here is a live aggregate over
// collections that already exist for other reasons (Booking, Visit,
// Waitlist, Offer) -- nothing computed or estimated, and no traveller
// identity is ever returned, only counts, matching the same privacy
// posture as the waitlist/contact-reveal endpoints (businesses.controller.js,
// waitlist.controller.js).
export const getOperatorAnalyticsController = async (req, res) => {
  try {
    if (req.user.role !== "operator") {
      return res.status(403).json({ message: "operator role required" });
    }

    const businesses = await Business.find({ ownerUserId: String(req.user._id) })
      .select("name destId type capacity visitCount")
      .lean();

    if (businesses.length === 0) {
      return res.status(200).json({ businesses: [], totals: emptyTotals() });
    }

    const businessIds = businesses.map((b) => b._id);
    const since30d = new Date(Date.now() - THIRTY_DAYS_MS);

    const [bookingRows, bookingTravellerRows, recentVisitRows, offerRows, waitlistRows] = await Promise.all([
      // Bookings per business, split by status -- real demand + fulfillment split.
      Booking.aggregate([
        { $match: { businessId: { $in: businessIds } } },
        { $group: { _id: { businessId: "$businessId", status: "$status" }, count: { $sum: 1 } } },
      ]),
      // Distinct travellers who have ever booked, per business.
      Booking.aggregate([
        { $match: { businessId: { $in: businessIds } } },
        { $group: { _id: "$businessId", travellers: { $addToSet: "$userId" } } },
      ]),
      Visit.aggregate([
        { $match: { businessId: { $in: businessIds }, verifiedAt: { $gte: since30d } } },
        { $group: { _id: "$businessId", count: { $sum: 1 }, travellers: { $addToSet: "$userId" } } },
      ]),
      Offer.aggregate([
        { $match: { businessId: { $in: businessIds } } },
        { $group: { _id: { businessId: "$businessId", status: "$status" }, count: { $sum: 1 } } },
      ]),
      // Waitlist is destId-scoped, not businessId-scoped (spec §2.1: "same
      // destId is the whole definition of nearby") -- grouped by destId here,
      // then attached to every business at that destination below.
      Waitlist.aggregate([
        { $match: { destId: { $in: businesses.map((b) => b.destId) }, state: "waiting" } },
        { $group: { _id: "$destId", count: { $sum: 1 } } },
      ]),
    ]);

    const bookingsByBusiness = groupNested(bookingRows, (r) => r._id.businessId, (r) => r._id.status, (r) => r.count);
    const bookingTravellerSets = new Map(bookingTravellerRows.map((r) => [r._id, new Set(r.travellers)]));
    const recentVisitsByBusiness = new Map(recentVisitRows.map((r) => [r._id, { count: r.count, travellers: new Set(r.travellers) }]));
    const offersByBusiness = groupNested(offerRows, (r) => r._id.businessId, (r) => r._id.status, (r) => r.count);
    const waitlistByDest = new Map(waitlistRows.map((r) => [r._id, r.count]));

    const businessAnalytics = businesses.map((b) => {
      const bookingCounts = bookingsByBusiness.get(b._id) || {};
      const bookingTotal = Object.values(bookingCounts).reduce((sum, n) => sum + n, 0);
      const recentVisits = recentVisitsByBusiness.get(b._id) || { count: 0, travellers: new Set() };
      const bookingTravellers = bookingTravellerSets.get(b._id) || new Set();
      const distinctTravellers = new Set([...bookingTravellers, ...recentVisits.travellers]).size;
      const offerCounts = offersByBusiness.get(b._id) || {};
      const offerTotal = Object.values(offerCounts).reduce((sum, n) => sum + n, 0);

      return {
        businessId: b._id,
        name: b.name,
        destId: b.destId,
        type: b.type,
        capacity: b.capacity ?? null,
        bookings: {
          total: bookingTotal,
          pending: bookingCounts.pending || 0,
          confirmed: bookingCounts.confirmed || 0,
          declined: bookingCounts.declined || 0,
          cancelled: bookingCounts.cancelled || 0,
        },
        distinctTravellers,
        visits: {
          total: b.visitCount || 0,
          last30Days: recentVisits.count,
        },
        waitlistDemand: waitlistByDest.get(b.destId) || 0,
        offers: {
          total: offerTotal,
          open: offerCounts.open || 0,
          claimed: offerCounts.claimed || 0,
          expired: offerCounts.expired || 0,
        },
      };
    });

    const totals = businessAnalytics.reduce(
      (acc, b) => ({
        bookings: acc.bookings + b.bookings.total,
        confirmedBookings: acc.confirmedBookings + b.bookings.confirmed,
        distinctTravellers: acc.distinctTravellers + b.distinctTravellers,
        visits: acc.visits + b.visits.total,
        waitlistDemand: acc.waitlistDemand + b.waitlistDemand,
        offersClaimed: acc.offersClaimed + b.offers.claimed,
      }),
      emptyTotals()
    );

    res.status(200).json({ businesses: businessAnalytics, totals });
  } catch (error) {
    console.log("Error in getOperatorAnalytics controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

function emptyTotals() {
  return { bookings: 0, confirmedBookings: 0, distinctTravellers: 0, visits: 0, waitlistDemand: 0, offersClaimed: 0 };
}

// Groups aggregation rows shaped [{_id: {businessId, status}, count}] into
// Map<businessId, {status: count}>.
function groupNested(rows, getBusinessId, getKey, getValue) {
  const map = new Map();
  for (const row of rows) {
    const businessId = getBusinessId(row);
    if (!map.has(businessId)) map.set(businessId, {});
    map.get(businessId)[getKey(row)] = getValue(row);
  }
  return map;
}
