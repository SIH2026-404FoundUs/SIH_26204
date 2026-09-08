// Spec §3.3 — periodic alert polling. Reuses ingestAlert() (hash-based
// idempotent upsert, mandatory sourceUrl/sourceName) rather than duplicating
// that logic; this file's only job is to produce candidate alerts from real
// sources and hand them to it.
//
// Honesty note: only the Open-Meteo source below is real. The other three
// sources the spec names (state road/PWD status pages, ASI/state monument
// closure notices, district administration notices) need destination-specific
// scrapers against real government sites this build does not have URLs or
// parsers for. Fabricating that scraping would violate the "no fabricated
// provider data" rule, so those sources are stubbed — each returns [] and
// says why, rather than inventing fake advisories.

import { argv } from "node:process";
import { pathToFileURL } from "node:url";
import { getForecast } from "../providers/openmeteo.provider.js";
import { ingestAlert } from "../services/alerts/alertService.js";

const HEAVY_RAIN_PRECIP_PCT = 70;
const EXTREME_HEAT_C = 38;
const EXTREME_COLD_C = 2;

const iso = (d) => d.toISOString().slice(0, 10);
// `new Date("2026-09-08")` is midnight UTC *start* of that day. Passing that
// same string as both validFrom and validTo produced a zero-width validity
// window -- the alert was already expired (validTo < now) within moments of
// being created, for the entire rest of the day. Confirmed live: 14 alerts
// ingested, GET /api/v1/alerts returned [] for all of them immediately
// after. validTo for a same-day advisory needs to be the END of that day.
const endOfDay = (isoDate) => new Date(`${isoDate}T23:59:59.999Z`);

// Real source: derives a same-day advisory from Open-Meteo's actual forecast
// when it crosses a hazard threshold. Not a government warning feed, but a
// genuine computation over real data, honestly attributed to Open-Meteo.
async function pollOpenMeteoWarnings(dest) {
  const { location } = dest;
  if (!location?.lat || !location?.lng) return [];
  const date = iso(new Date());
  const r = await getForecast(location.lat, location.lng, date);
  if (!r.ok) return [];

  const { maxTempC, precipProb } = r.data;
  const candidates = [];
  if (precipProb >= HEAVY_RAIN_PRECIP_PCT) {
    candidates.push({
      destId: dest._id, kind: "weather", severity: "warning",
      body: `Heavy rain likely today (${precipProb}% precipitation probability). Roads and outdoor activities may be affected.`,
      sourceUrl: "https://open-meteo.com/", sourceName: "Open-Meteo Weather API",
      validFrom: date, validTo: endOfDay(date),
    });
  }
  if (maxTempC >= EXTREME_HEAT_C) {
    candidates.push({
      destId: dest._id, kind: "weather", severity: "warning",
      body: `Extreme heat expected today (max ${maxTempC}°C). Stay hydrated and avoid midday outdoor exposure.`,
      sourceUrl: "https://open-meteo.com/", sourceName: "Open-Meteo Weather API",
      validFrom: date, validTo: endOfDay(date),
    });
  }
  if (maxTempC <= EXTREME_COLD_C) {
    candidates.push({
      destId: dest._id, kind: "weather", severity: "warning",
      body: `Extreme cold expected today (max ${maxTempC}°C). Carry cold-weather gear.`,
      sourceUrl: "https://open-meteo.com/", sourceName: "Open-Meteo Weather API",
      validFrom: date, validTo: endOfDay(date),
    });
  }
  return candidates;
}

// Stubs — spec-named sources with no real scraper behind them yet. Each
// returns [] rather than fabricating advisory content or a fake sourceUrl.
async function pollRoadPwdStatus(_dest) { return []; }
async function pollAsiMonumentClosures(_dest) { return []; }
async function pollDistrictNotices(_dest) { return []; }

const SOURCES = [pollOpenMeteoWarnings, pollRoadPwdStatus, pollAsiMonumentClosures, pollDistrictNotices];

/**
 * @param {object[]} dests   seed destination rows to poll
 * @param {object}   models  { AlertModel, AuditLogModel } for ingestAlert()
 * @returns {{ ingested:number, skipped:number, errors:Array }}
 */
export async function runPollAlerts(dests, models) {
  let ingested = 0;
  let skipped = 0;
  const errors = [];

  for (const dest of dests) {
    for (const source of SOURCES) {
      let candidates = [];
      try {
        candidates = await source(dest);
      } catch (err) {
        errors.push({ destId: dest._id, source: source.name, error: err.message });
        continue;
      }
      for (const alertData of candidates) {
        const result = await ingestAlert(alertData, models);
        if (result.success) ingested++;
        else { skipped++; errors.push({ destId: dest._id, error: result.message || result.error }); }
      }
    }
  }
  return { ingested, skipped, errors };
}

// CLI: `node src/jobs/pollAlerts.job.js`
if (argv[1] && import.meta.url === pathToFileURL(argv[1]).href) {
  const [{ connectDB }, dotenv, { loadDestinations }, Alert, AuditLog] = await Promise.all([
    import("../lib/db.js"),
    import("dotenv"),
    import("../services/pressure/seed.js"),
    import("../models/alert.model.js"),
    import("../models/auditLog.model.js"),
  ]);
  dotenv.default.config();
  await connectDB();
  const res = await runPollAlerts(loadDestinations(), {
    AlertModel: Alert.default,
    AuditLogModel: AuditLog.default,
  });
  console.log("pollAlerts done:", res);
  process.exit(0);
}
