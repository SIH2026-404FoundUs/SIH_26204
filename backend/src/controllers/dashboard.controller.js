// Authority Dashboard — four endpoints, all mounted behind protectRoute +
// requireRole("authority") in routes/dashboard.route.js. Every controller
// here is a thin wrapper: the pressure endpoint reuses the exact same
// service function the public /api/v1/pressure/map route already calls
// (pressure data itself stays public elsewhere by design -- this route
// exists so the dashboard has its own authority-gated entry point per the
// dashboard spec, not because the underlying numbers are secret), and the
// other three read from services/dashboard/*.js rather than duplicating any
// aggregation logic inline.
import { getPressureMap } from "../services/pressure/service.js";
import { computeCapacityGapForDate } from "../services/dashboard/capacityGap.js";
import { computeTripsAnalytics } from "../services/dashboard/tripsAnalytics.js";
import { isValidCalendarDate } from "../lib/dateValidation.js";

function requireDateParam(req, res) {
  const { date } = req.query;
  if (!date) {
    res.status(400).json({ message: "date query param required (YYYY-MM-DD)" });
    return null;
  }
  if (!isValidCalendarDate(date)) {
    res.status(400).json({ message: "date must be a real calendar date in YYYY-MM-DD format" });
    return null;
  }
  return date;
}

// GET /api/v1/dashboard/pressure?date=YYYY-MM-DD
export const getDashboardPressureController = async (req, res) => {
  try {
    const date = requireDateParam(req, res);
    if (!date) return;
    const rows = await getPressureMap(date);
    res.status(200).json({ date, destinations: rows });
  } catch (error) {
    console.log("Error in getDashboardPressure controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// GET /api/v1/dashboard/capacity?date=YYYY-MM-DD
export const getDashboardCapacityController = async (req, res) => {
  try {
    const date = requireDateParam(req, res);
    if (!date) return;
    const destinations = await computeCapacityGapForDate(date);
    res.status(200).json({ date, destinations });
  } catch (error) {
    console.log("Error in getDashboardCapacity controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// GET /api/v1/dashboard/redistribution
// Not date-filtered: trips don't carry a single canonical date field this
// aggregation could honestly filter on (requestedDates/finalDates are
// ranges, not a point), so unlike pressure/capacity this reflects the whole
// trips collection every time, exactly like the existing (unauthenticated)
// GET /api/v1/trips/summary this was built alongside. A `date` query param
// here would only imply a filter that doesn't actually apply.
export const getDashboardRedistributionController = async (req, res) => {
  try {
    const analytics = await computeTripsAnalytics();
    res.status(200).json({
      redirectedTrips: analytics.redirectedTrips,
      totalBudgetMovedINR: analytics.totalBudgetMovedINR,
      averagePressureRelief: analytics.averagePressureRelief,
      byDestination: analytics.byDestination,
    });
  } catch (error) {
    console.log("Error in getDashboardRedistribution controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// GET /api/v1/dashboard/acceptance -- same non-date-filtered reasoning as
// redistribution above.
export const getDashboardAcceptanceController = async (req, res) => {
  try {
    const analytics = await computeTripsAnalytics();
    res.status(200).json({
      acceptanceRate: analytics.acceptanceRate,
      accepted: analytics.accepted,
      alternativesOffered: analytics.alternativesOffered,
      totalTrips: analytics.totalTrips,
    });
  } catch (error) {
    console.log("Error in getDashboardAcceptance controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
