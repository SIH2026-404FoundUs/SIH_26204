// backend/src/services/pressure/featureBuilder.js
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getClimatology } from "./seeds_v3.js";

const SEEDS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../seeds");
const DAY_MS = 24 * 60 * 60 * 1000;

let _holidays = null;

function loadHolidays() {
  if (!_holidays) {
    try {
      const raw = JSON.parse(readFileSync(join(SEEDS_DIR, "calendar.json"), "utf8"));
      _holidays = raw
        .filter(
          (r) =>
            r.impact > 0.4 ||
            (r.label &&
              !r.label.toLowerCase().includes("weekend") &&
              !r.label.toLowerCase().includes("weekday"))
        )
        .map((r) => ({
          dateStr: r.date.slice(0, 10),
          time: new Date(`${r.date.slice(0, 10)}T00:00:00Z`).getTime(),
          state: r.state || null,
        }));
    } catch (err) {
      console.warn("[featureBuilder] Could not load calendar.json for holidays:", err.message);
      _holidays = [];
    }
  }
  return _holidays;
}

/**
 * Builds the strict 19-feature vector required by the ML demand model.
 * @param {object} dest          Destination object from seeds/destinations/*.json
 * @param {string} dateStr       "YYYY-MM-DD"
 * @param {object} [weatherData] { maxTempC, precipProb, precipMm, tempC }
 * @returns {object} Dictionary of 19 feature names and float values
 */
export function buildFeatures(dest, dateStr, weatherData = null) {
  if (!dest || !dateStr) {
    throw new Error("[featureBuilder] dest and dateStr are required");
  }

  const d = new Date(`${dateStr}T00:00:00Z`);
  const month = d.getUTCMonth() + 1; // 1-12
  const dow = d.getUTCDay(); // 0=Sun, 6=Sat

  const is_weekend = dow === 0 || dow === 6 ? 1.0 : 0.0;
  const is_monsoon = month >= 6 && month <= 9 ? 1.0 : 0.0;

  const month_sin = Math.sin((2 * Math.PI * month) / 12);
  const month_cos = Math.cos((2 * Math.PI * month) / 12);

  const dow_sin = Math.sin((2 * Math.PI * dow) / 7);
  const dow_cos = Math.cos((2 * Math.PI * dow) / 7);

  // Calendar holiday calculations
  const targetTime = d.getTime();
  const holidays = loadHolidays();

  let is_holiday = 0.0;
  let minDiffDays = 30.0;

  for (const h of holidays) {
    if (h.state && dest.state && h.state !== dest.state) continue;
    const diffDays = Math.abs(targetTime - h.time) / DAY_MS;
    if (diffDays === 0) {
      is_holiday = 1.0;
    }
    if (diffDays < minDiffDays) {
      minDiffDays = diffDays;
    }
  }

  const days_to_holiday = Math.min(30.0, Math.max(0.0, minDiffDays));

  // Weather features with climatology fallback
  const destId = dest._id || dest.id;
  const clim = getClimatology(destId, month, is_weekend === 1.0);

  let tempC = weatherData?.maxTempC ?? weatherData?.tempC ?? clim?.tempC ?? null;
  let precipMm = weatherData?.precipMm ?? clim?.precipMm ?? null;

  if (tempC == null) {
    console.warn(`[featureBuilder] tempC missing for ${destId} on ${dateStr}, defaulting to 0.0`);
    tempC = 0.0;
  }
  if (precipMm == null) {
    console.warn(`[featureBuilder] precipMm missing for ${destId} on ${dateStr}, defaulting to 0.0`);
    precipMm = 0.0;
  }

  // Top-level destination attributes
  const attr_snow = Number(dest.attr_snow ?? 0.0);
  const attr_trek = Number(dest.attr_trek ?? 0.0);
  const attr_riverside = Number(dest.attr_riverside ?? 0.0);
  const attr_heritage = Number(dest.attr_heritage ?? 0.0);
  const attr_nightlife = Number(dest.attr_nightlife ?? 0.0);
  const attr_food = Number(dest.attr_food ?? 0.0);
  const attr_wildlife = Number(dest.attr_wildlife ?? 0.0);
  const attr_spiritual = Number(dest.attr_spiritual ?? 0.0);
  const cap_prior_dest = Number(dest.capacityPrior ?? 0.0);

  return {
    is_weekend,
    is_monsoon,
    month_sin,
    month_cos,
    dow_sin,
    dow_cos,
    is_holiday,
    days_to_holiday,
    tempC,
    precipMm,
    attr_snow,
    attr_trek,
    attr_riverside,
    attr_heritage,
    attr_nightlife,
    attr_food,
    attr_wildlife,
    attr_spiritual,
    cap_prior_dest,
  };
}
