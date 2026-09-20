// Operator Revenue Management System -- rule-based/statistical revenue
// intelligence for one operator's own business, built from data that
// genuinely exists in this codebase (Booking, BusinessAvailability, and the
// real destination pressure engine), not a trained ML model.
//
// Why rule-based, not the XGBoost/LightGBM the original design doc calls
// for: real demand forecasting needs real historical booking volume to
// learn from, and this platform has none yet at meaningful scale (mostly
// seed/test data). Training a model on that would produce numbers that
// LOOK like machine learning but are actually noise -- worse than being
// honest about a transparent formula. Every number this engine produces is
// explainable in one sentence, matches this codebase's existing
// "heuristic-fallback, never fabricated" convention (see
// services/feedback/feedbackService.js, services/community/growthRanking.js),
// and every fallback/assumption used only for lack of real history is
// explicitly labelled `lowConfidence` and named in that day's `reasons`, the
// same honesty pattern services/pressure/service.js already uses
// (stale/degraded/lowConfidence flags on every row). This can be swapped
// for a real trained model later without changing the API shape -- callers
// only ever consume {forecastedOccupancy, demandLevel, reasons, ...}.
import Booking from "../../models/booking.model.js";
import BusinessAvailability from "../../models/businessAvailability.model.js";
import { getPressure } from "../pressure/service.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const HISTORY_LOOKBACK_DAYS = 90;
const LOW_DEMAND_OCCUPANCY = 0.35;
const HIGH_DEMAND_OCCUPANCY = 0.8;
// No declared capacity anywhere for this business (older/seed businesses
// predate the operator-registration flow's `capacity` field) -- a small,
// clearly-labelled placeholder so the engine can still produce *something*
// rather than divide by zero, never presented as a real declared number.
const FALLBACK_CAPACITY = 10;
// Used only when this business has zero real confirmed-booking history at
// all (see weekdayBaselines below) -- an assumed flat occupancy to seed a
// first forecast from, not derived from any of this business's own data.
const NO_HISTORY_BASELINE_OCCUPANCY = 0.4;
// Same "no real history yet" carve-out for weekend uplift: once real
// per-weekday history exists, weekend effects are already implicit in it and
// this multiplier is not applied on top.
const ASSUMED_WEEKEND_UPLIFT = 1.15;
// What-if simulator only: assumed price elasticity (% occupancy change per
// % price change), since there's no real price/occupancy correlation
// history to fit one from yet. Documented, not fabricated as measured.
const ASSUMED_PRICE_ELASTICITY = 0.6;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const dateStr = (d) => d.toISOString().slice(0, 10);
const toUTCDate = (dateISO) => new Date(`${dateISO}T00:00:00.000Z`);
const addDays = (dateISO, n) => {
  const d = toUTCDate(dateISO);
  d.setUTCDate(d.getUTCDate() + n);
  return dateStr(d);
};
const isWeekend = (dateISO) => [0, 6].includes(toUTCDate(dateISO).getUTCDay());
const round2 = (n) => Math.round(n * 100) / 100;

function effectiveCapacity(business, availabilityRow) {
  return availabilityRow?.units?.total || business?.capacity || FALLBACK_CAPACITY;
}

function declaredPrice(business, availabilityRow) {
  if (availabilityRow?.pricePerNight != null) return availabilityRow.pricePerNight;
  const range = business?.priceRangeINR;
  if (range?.min != null && range?.max != null) return Math.round((range.min + range.max) / 2);
  return range?.min ?? range?.max ?? null;
}

// Real per-weekday average of CONFIRMED bookings for this business, from
// actual Booking records over the last HISTORY_LOOKBACK_DAYS -- one count
// per calendar date, averaged per day-of-week. A weekday with no samples of
// its own falls back to this business's own overall average (still real
// data, just less specific) rather than a made-up number; a business with
// zero confirmed bookings at all gets `sampleCount: 0` on every weekday, the
// signal the forecaster uses to fall back to NO_HISTORY_BASELINE_OCCUPANCY.
async function weekdayBaselines(businessId) {
  const since = new Date(Date.now() - HISTORY_LOOKBACK_DAYS * DAY_MS);
  const bookings = await Booking.find({ businessId, status: "confirmed", date: { $gte: since } })
    .select("date")
    .lean();

  const perDateCount = new Map();
  for (const b of bookings) {
    const iso = dateStr(new Date(b.date));
    perDateCount.set(iso, (perDateCount.get(iso) || 0) + 1);
  }

  const byWeekday = Array.from({ length: 7 }, () => []);
  for (const [iso, count] of perDateCount) {
    byWeekday[toUTCDate(iso).getUTCDay()].push(count);
  }

  const overall = [...perDateCount.values()];
  const overallAvg = overall.length ? overall.reduce((a, b) => a + b, 0) / overall.length : 0;

  return byWeekday.map((samples) => ({
    avg: samples.length ? samples.reduce((a, b) => a + b, 0) / samples.length : overallAvg,
    sampleCount: samples.length,
  }));
}

// destId is nullable in practice (an onboarding draft can still be missing
// one) -- pressure is simply unavailable for such a business, not an error.
async function pressureScoreFor(destId, dateISO) {
  if (!destId) return null;
  try {
    const row = await getPressure(destId, dateISO);
    return typeof row?.score === "number" ? row.score : null;
  } catch {
    return null;
  }
}

function demandLevelFor(occupancy) {
  if (occupancy >= HIGH_DEMAND_OCCUPANCY) return "high";
  if (occupancy <= LOW_DEMAND_OCCUPANCY) return "low";
  return "medium";
}

// One forecast day for one business -- the shared building block behind the
// forecast list, recommendations, alerts, and (via a synthetic override
// price) the what-if simulator.
async function forecastDay(business, dateISO, baseline, availabilityRow) {
  const capacity = effectiveCapacity(business, availabilityRow);
  const pressureScore = await pressureScoreFor(business.destId, dateISO);
  // Maps a 0..1 pressure score onto a 0.6x..1.4x demand multiplier -- a
  // destination at the platform's own "moderate" pressure (0.5) leaves
  // forecasted bookings unchanged; more/less crowded shifts it
  // proportionally. Same score this platform already surfaces everywhere
  // else (heatmap, substitution engine), not a new signal invented here.
  const pressureMultiplier = pressureScore == null ? 1 : 0.6 + pressureScore * 0.8;

  const hasHistory = baseline.sampleCount > 0;
  let forecastedBookings = hasHistory ? baseline.avg : capacity * NO_HISTORY_BASELINE_OCCUPANCY;
  const weekendApplied = !hasHistory && isWeekend(dateISO);
  if (weekendApplied) forecastedBookings *= ASSUMED_WEEKEND_UPLIFT;
  forecastedBookings *= pressureMultiplier;

  const forecastedOccupancy = clamp(forecastedBookings / capacity, 0, 1);
  const demandLevel = demandLevelFor(forecastedOccupancy);
  const price = declaredPrice(business, availabilityRow);
  const expectedRevenueINR = price != null ? Math.round(forecastedOccupancy * capacity * price) : null;

  const reasons = [];
  reasons.push(
    hasHistory
      ? `Based on this business's own history: averages ${round2(baseline.avg)} confirmed booking(s) on this day of week (${baseline.sampleCount} sample${baseline.sampleCount === 1 ? "" : "s"} in the last ${HISTORY_LOOKBACK_DAYS} days).`
      : `No confirmed-booking history yet for this business -- using a flat ${Math.round(NO_HISTORY_BASELINE_OCCUPANCY * 100)}% baseline occupancy assumption (low confidence).`
  );
  if (weekendApplied) reasons.push(`Weekend uplift assumption applied (+${Math.round((ASSUMED_WEEKEND_UPLIFT - 1) * 100)}%) -- no real history yet to derive this business's own weekend pattern.`);
  if (pressureScore != null) {
    reasons.push(`Destination demand/pressure is ${Math.round(pressureScore * 100)}% -- ${pressureScore > 0.5 ? "raising" : pressureScore < 0.5 ? "lowering" : "not changing"} the forecast.`);
  } else {
    reasons.push("Destination pressure data unavailable for this date -- forecast uses booking history alone.");
  }
  if (availabilityRow) reasons.push(`${availabilityRow.units.available} of ${availabilityRow.units.total} units still open on this declared date.`);
  if (price == null) reasons.push("No price declared for this date -- revenue cannot be estimated.");

  return {
    date: dateISO,
    isWeekend: isWeekend(dateISO),
    forecastedBookings: round2(forecastedBookings),
    forecastedOccupancy: round2(forecastedOccupancy),
    demandLevel,
    capacity,
    remainingUnits: availabilityRow?.units?.available ?? null,
    declaredPriceINR: price,
    expectedRevenueINR,
    pressureScore,
    lowConfidence: !hasHistory,
    reasons,
  };
}

// GET .../dashboard -- today's real KPIs (from actual Booking/
// BusinessAvailability rows, no forecasting involved) plus the N-day
// forward forecast and the recommendations/alerts derived from it.
export async function buildRevenueDashboard(business, { today, forecastDays = 7 } = {}) {
  const [todayAvailability, todayBookings, baselines] = await Promise.all([
    BusinessAvailability.findOne({ businessId: business._id, date: toUTCDate(today) }).lean(),
    Booking.find({ businessId: business._id, date: toUTCDate(today), status: "confirmed" }).lean(),
    weekdayBaselines(business._id),
  ]);

  const capacityToday = effectiveCapacity(business, todayAvailability);
  const occupancyToday = todayAvailability
    ? round2((todayAvailability.units.total - todayAvailability.units.available) / todayAvailability.units.total)
    : round2(Math.min(1, todayBookings.length / capacityToday));
  const adrToday = declaredPrice(business, todayAvailability);
  const revenueTodayINR = adrToday != null ? Math.round(adrToday * todayBookings.length) : null;
  const revPARToday = adrToday != null ? round2(adrToday * occupancyToday) : null;
  const pressureToday = await pressureScoreFor(business.destId, today);
  const demandIndex = Math.round(((pressureToday ?? 0.5) * 0.5 + occupancyToday * 0.5) * 100);

  const forecast = [];
  for (let i = 0; i < forecastDays; i++) {
    const dateISO = addDays(today, i);
    const availabilityRow = i === 0 ? todayAvailability : await BusinessAvailability.findOne({ businessId: business._id, date: toUTCDate(dateISO) }).lean();
    const baseline = baselines[toUTCDate(dateISO).getUTCDay()];
    forecast.push(await forecastDay(business, dateISO, baseline, availabilityRow));
  }

  const recommendations = [];
  for (const day of forecast) {
    if (day.demandLevel === "high") {
      if (day.declaredPriceINR != null) {
        const range = business.priceRangeINR;
        const suggestedLow = Math.round(day.declaredPriceINR * 1.05);
        const suggestedHigh = Math.min(Math.round(day.declaredPriceINR * 1.15), range?.max || Infinity);
        if (suggestedHigh > day.declaredPriceINR) {
          recommendations.push({
            date: day.date,
            type: "price",
            action: `Consider raising the price to ₹${suggestedLow.toLocaleString("en-IN")}–₹${suggestedHigh.toLocaleString("en-IN")} (currently ₹${day.declaredPriceINR.toLocaleString("en-IN")}).`,
            reasons: day.reasons,
          });
        }
      }
      recommendations.push({
        date: day.date,
        type: "inventory",
        action: day.remainingUnits != null
          ? `Protect the remaining ${day.remainingUnits} unit(s) for this high-demand date -- avoid discounting.`
          : "Protect inventory for this high-demand date -- avoid discounting.",
        reasons: day.reasons,
      });
    } else if (day.demandLevel === "low") {
      recommendations.push({
        date: day.date,
        type: "promotion",
        action: "Offer a weekday discount (roughly 10–15%) or a bundled package instead of an outright price cut.",
        reasons: day.reasons,
      });
      recommendations.push({
        date: day.date,
        type: "inventory",
        action: "Open additional inventory or pair with a local experience to help fill this date.",
        reasons: day.reasons,
      });
    }
  }

  const lowDemandAlerts = forecast.filter((d) => d.demandLevel === "low").map((d) => ({ date: d.date, forecastedOccupancy: d.forecastedOccupancy, reasons: d.reasons }));

  return {
    businessId: business._id,
    today: {
      date: today,
      occupancy: occupancyToday,
      adrINR: adrToday,
      revPARINR: revPARToday,
      revenueINR: revenueTodayINR,
      demandIndex,
      availableUnits: todayAvailability?.units?.available ?? null,
      totalUnits: todayAvailability?.units?.total ?? capacityToday,
      confirmedBookings: todayBookings.length,
      pressureScore: pressureToday,
    },
    forecast,
    recommendations,
    lowDemandAlerts,
  };
}

// POST .../simulate -- what-if price comparison for one date. Reuses the
// exact same forecastDay() the dashboard's own forecast is built from (so
// the "current price" row always matches the dashboard's own number for
// that date), then re-derives occupancy/revenue at each candidate price
// using the documented elasticity assumption above.
export async function simulatePrices(business, dateISO, prices) {
  const [availabilityRow, baselines] = await Promise.all([
    BusinessAvailability.findOne({ businessId: business._id, date: toUTCDate(dateISO) }).lean(),
    weekdayBaselines(business._id),
  ]);
  const baseline = baselines[toUTCDate(dateISO).getUTCDay()];
  const baseDay = await forecastDay(business, dateISO, baseline, availabilityRow);
  const capacity = baseDay.capacity;
  const basePrice = baseDay.declaredPriceINR;

  if (basePrice == null) {
    return { date: dateISO, error: "No declared or price-range data for this business -- nothing to simulate against.", results: [] };
  }

  const results = prices.map((price) => {
    const priceDelta = (price - basePrice) / basePrice;
    const occupancy = clamp(baseDay.forecastedOccupancy * (1 - ASSUMED_PRICE_ELASTICITY * priceDelta), 0, 1);
    return {
      priceINR: price,
      expectedOccupancy: round2(occupancy),
      expectedRevenueINR: Math.round(occupancy * capacity * price),
    };
  });

  return { date: dateISO, basePriceINR: basePrice, baseOccupancy: baseDay.forecastedOccupancy, results };
}
