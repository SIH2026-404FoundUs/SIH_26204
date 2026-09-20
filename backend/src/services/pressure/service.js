// The functions the rest of the platform calls (spec §11). Madhuri's
// substitution engine and heatmap import getPressure() directly; the HTTP
// controller is a thin wrapper over these.

import DestinationPressure from "../../models/destinationPressure.model.js";
import { loadDestinations, getDestination, calendarRow } from "./seed.js";
import { collect } from "./collectors.js";
import { assembleRow, FORMULA_VERSION } from "./engine.js";
import { realProviders } from "./realProviders.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const LIVE_TIMEOUT_MS = 4000; // spec §7: short budget, never sit on the demo path
const CONCURRENCY_LIMIT = parseInt(process.env.PRESSURE_MAP_CONCURRENCY || "10", 10);

const providers = realProviders;
const seed = { calendarRow };

const isFresh = (row) =>
  Date.now() - new Date(row.computedAt).getTime() < DAY_MS &&
  row.formulaVersion === FORMULA_VERSION;

const withTimeout = (p, ms) =>
  Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error("timeout")), ms))]);

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let idx = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = idx++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

// compute one row from live provider readings and upsert it (spec §6 shape)
export async function computeAndStore(dest, date) {
  const { values, degradedRoad } = await collect(dest, date, { providers, seed });
  const row = assembleRow(values, { degradedRoad });
  const destId = dest._id || dest.id;
  const _id = `${destId}_${date}`;
  const doc = { _id, destId, date, ...row, stale: false, computedAt: new Date() };
  await DestinationPressure.updateOne(
    { _id },
    { $set: doc },
    { upsert: true }
  );
  return doc;
}

/**
 * spec §11 — the full destination_pressure row for one dest/date.
 * Serves a cached row if it is < 24h old; otherwise recomputes live on a short
 * budget and falls back to the newest stored row on timeout (spec §7).
 * @returns row object, or null if the dest is unknown and nothing is stored.
 */
export async function getPressure(destId, date) {
  const stored = await DestinationPressure.findOne({ destId, date }).lean();
  if (stored && isFresh(stored)) return { ...stored, stale: false };

  const dest = getDestination(destId);
  if (!dest) return stored ? { ...stored, stale: true } : null;

  try {
    return await withTimeout(computeAndStore(dest, date), LIVE_TIMEOUT_MS);
  } catch {
    const newest =
      stored ||
      (await DestinationPressure.findOne({ destId }).sort({ date: -1 }).lean());
    return newest ? { ...newest, stale: true } : null;
  }
}

// spec §10 /pressure/map — every tracked destination for one date.
// Dynamically ensures every tracked destination has pressure data for any date.
export async function getPressureMap(date) {
  const allDests = loadDestinations();
  const existingRows = await DestinationPressure.find({ date }).lean();
  const existingMap = new Map(existingRows.map((r) => [r.destId, r]));

  const cachedCount = allDests.filter((d) => {
    const r = existingMap.get(d._id || d.id);
    return r && isFresh(r);
  }).length;
  const liveComputeCount = allDests.length - cachedCount;

  console.log(
    `[getPressureMap] date=${date} total=${allDests.length} live_compute=${liveComputeCount} cached=${cachedCount}`
  );

  const fullRows = await mapWithConcurrency(allDests, CONCURRENCY_LIMIT, async (d) => {
    const dId = d._id || d.id;
    if (existingMap.has(dId)) {
      const r = existingMap.get(dId);
      if (isFresh(r)) {
        return {
          ...r,
          stale: false,
          lat: d.lat ?? d.location?.lat ?? null,
          lng: d.lng ?? d.location?.lng ?? null,
        };
      }
    }
    try {
      const row = await getPressure(dId, date);
      if (row) {
        return {
          ...row,
          lat: d.lat ?? d.location?.lat ?? null,
          lng: d.lng ?? d.location?.lng ?? null,
        };
      }
    } catch (e) {
      console.error(`[getPressureMap] Failed live compute for ${dId} on ${date}:`, e);
    }

    const newest =
      existingMap.get(dId) ||
      (await DestinationPressure.findOne({ destId: dId }).sort({ date: -1 }).lean());

    return newest
      ? {
          ...newest,
          date,
          stale: true,
          lat: d.lat ?? d.location?.lat ?? null,
          lng: d.lng ?? d.location?.lng ?? null,
        }
      : null;
  });

  return fullRows.filter(Boolean);
}
