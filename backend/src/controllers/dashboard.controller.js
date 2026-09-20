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
import { laborDemandGap } from "../services/incentive/laborDemandGap.js";
import { loadDestinations } from "../services/pressure/seed.js";
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

// GET /api/v1/dashboard/summary?date=YYYY-MM-DD -- one round trip for the
// whole Authority Dashboard instead of the four separate requests
// (pressure/capacity/redistribution/acceptance) the frontend used to fire
// on every mount and every 15s poll. computeTripsAnalytics() is also only
// called ONCE here and reused for both redistribution and acceptance,
// instead of the redundant second computation the two separate endpoints
// used to each trigger independently.
//
// Each section is settled independently (Promise.allSettled, not
// Promise.all) and always responds 200 with per-section data-or-error --
// preserves the dashboard spec's "one section failing never blocks the
// other three" requirement (see useAuthorityDashboardStore.js's own header
// comment) even though it's now one HTTP request instead of four; a single
// rejected Promise.all would otherwise have taken every section down
// together, a real behavior regression this endpoint must not introduce.
async function settle(promise) {
  try {
    return { ok: true, value: await promise };
  } catch (error) {
    return { ok: false, message: error.message || "Failed to load" };
  }
}

export const getDashboardSummaryController = async (req, res) => {
  const date = requireDateParam(req, res);
  if (!date) return;

  const [pressure, capacity, analytics] = await Promise.all([
    settle(getPressureMap(date)),
    settle(computeCapacityGapForDate(date)),
    settle(computeTripsAnalytics()),
  ]);

  res.status(200).json({
    date,
    pressure: pressure.ok ? { date, destinations: pressure.value } : { error: pressure.message },
    capacity: capacity.ok ? { date, destinations: capacity.value } : { error: capacity.message },
    redistribution: analytics.ok
      ? {
          redirectedTrips: analytics.value.redirectedTrips,
          totalBudgetMovedINR: analytics.value.totalBudgetMovedINR,
          averagePressureRelief: analytics.value.averagePressureRelief,
          byDestination: analytics.value.byDestination,
        }
      : { error: analytics.message },
    acceptance: analytics.ok
      ? {
          acceptanceRate: analytics.value.acceptanceRate,
          accepted: analytics.value.accepted,
          alternativesOffered: analytics.value.alternativesOffered,
          totalTrips: analytics.value.totalTrips,
        }
      : { error: analytics.message },
  });
};

// GET /api/v1/dashboard/labor?date=YYYY-MM-DD -- Worker role design spec
// §08: laborDemandGap(destId, date) fed to every tracked destination, the
// same read-only-signal treatment the pressure/capacity endpoints above
// already get. Purely additive -- nothing above this function changes.
export const getDashboardLaborController = async (req, res) => {
  try {
    const date = requireDateParam(req, res);
    if (!date) return;
    const destinations = loadDestinations();
    const rows = await Promise.all(
      destinations.map(async (dest) => {
        const { openGigsHeadcount, availableWorkers, laborDemandGap: gap } = await laborDemandGap(dest._id, date);
        return {
          destId: dest._id,
          displayName: dest.displayName ?? dest.name ?? dest._id,
          openGigsHeadcount,
          availableWorkers,
          laborDemandGap: gap,
        };
      })
    );
    res.status(200).json({ date, destinations: rows });
  } catch (error) {
    console.log("Error in getDashboardLabor controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
