// backend/src/services/pressure/seeds_v3.js
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SEEDS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../seeds");

let _demandBaseline = null;
let _providerClimatology = null;

function readJSON(filename) {
  const filePath = join(SEEDS_DIR, filename);
  const start = Date.now();
  const data = JSON.parse(readFileSync(filePath, "utf8"));
  return { data, filePath, latencyMs: Date.now() - start };
}

export function loadDemandBaseline() {
  if (!_demandBaseline) {
    const { data, filePath, latencyMs } = readJSON("demand_baseline.json");
    _demandBaseline = data;
    const byMonthCount = Object.keys(data.by_dest_month || {}).length;
    const byAnnualCount = Object.keys(data.by_dest_annual || {}).length;
    console.log(
      `[SeedsV3] Loaded ${filePath} in ${latencyMs}ms (by_dest_month: ${byMonthCount}, by_dest_annual: ${byAnnualCount})`
    );
  }
  return _demandBaseline;
}

export function loadProviderClimatology() {
  if (!_providerClimatology) {
    const { data, filePath, latencyMs } = readJSON("provider_climatology.json");
    _providerClimatology = data;
    const byMwCount = Object.keys(data.by_dest_month_weekend || {}).length;
    const fallbackCount = Object.keys(data.by_dest_fallback || {}).length;
    console.log(
      `[SeedsV3] Loaded ${filePath} in ${latencyMs}ms (by_dest_month_weekend: ${byMwCount}, by_dest_fallback: ${fallbackCount})`
    );
  }
  return _providerClimatology;
}

/**
 * Get monthly baseline visitors for a destination slug.
 * @param {string} destId  Destination string slug (never pass parsed int!)
 * @param {number} month   1-12
 * @returns {number}
 */
export function getBaselineVisitors(destId, month) {
  if (!destId) return 1000;
  const base = loadDemandBaseline();
  const key = `${destId}|${month}`;
  if (base.by_dest_month && base.by_dest_month[key] != null) {
    return base.by_dest_month[key];
  }
  if (base.by_dest_annual && base.by_dest_annual[destId] != null) {
    return base.by_dest_annual[destId];
  }
  return 1000;
}

/**
 * Get climatology weather fallback for a destination slug.
 * @param {string} destId
 * @param {number} month 1-12
 * @param {boolean|number} isWeekend
 * @returns {object|null}
 */
export function getClimatology(destId, month, isWeekend) {
  if (!destId) return null;
  const clim = loadProviderClimatology();
  const flag = isWeekend ? 1 : 0;
  const key = `${destId}|${month}|${flag}`;

  if (clim.by_dest_month_weekend && clim.by_dest_month_weekend[key] != null) {
    return clim.by_dest_month_weekend[key];
  }
  if (clim.by_dest_fallback && clim.by_dest_fallback[destId] != null) {
    return clim.by_dest_fallback[destId];
  }
  return null;
}
