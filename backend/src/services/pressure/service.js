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

const providers = realProviders;
const seed = { calendarRow };

// A row is fresh only if it's both recent AND computed under the current
// locked formula. A row on an older formulaVersion (e.g. Ananya's seed
// history, computed before the weights were locked) fails this regardless of
// how recent its computedAt is -- it must never be reported as current. This
// also fixes getPressureMap(), which never recomputes live (by design, so the
// demo path never blocks on a five-provider fetch) but must not silently
// serve pre-lock-weight rows as if they were fine.
const isFresh = (row) =>
  Date.now() - new Date(row.computedAt).getTime() < DAY_MS &&
  row.formulaVersion === FORMULA_VERSION;
const withTimeout = (p, ms) =>
  Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error("timeout")), ms))]);

// compute one row from live provider readings and upsert it (spec §6 shape)
export async function computeAndStore(dest, date) {
  const { values, degradedRoad } = await collect(dest, date, { providers, seed });
  const row = assembleRow(values, { degradedRoad });
  const doc = { destId: dest._id, date, ...row, stale: false, computedAt: new Date() };
  await DestinationPressure.updateOne(
    { destId: dest._id, date },
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

  if (existingMap.size >= allDests.length) {
    return allDests.map((d) => {
      const r = existingMap.get(d._id);
      return { ...r, stale: !isFresh(r) };
    });
  }

  const fullRows = await Promise.all(
    allDests.map(async (d) => {
      if (existingMap.has(d._id)) {
        const r = existingMap.get(d._id);
        return { ...r, stale: !isFresh(r) };
      }
      try {
        const row = await getPressure(d._id, date);
        if (row) return row;
      } catch (e) {
        console.error(`Failed to get pressure for ${d._id} on ${date}:`, e);
      }
      const newest = await DestinationPressure.findOne({ destId: d._id }).sort({ date: -1 }).lean();
      return newest ? { ...newest, date, stale: true } : null;
    })
  );

  return fullRows.filter(Boolean);
  const rows = await DestinationPressure.find({ date }).lean();
  // Enrich with lat/lng from the seed file (never stored on the Mongo row
  // itself -- destination_pressures only ever held the computed score, not
  // the destination's static facts). Additive only: every field the map
  // response already had is untouched, so no existing consumer's parsing
  // of this shape can break. Powers the India-outline map on the frontend.
  return rows.map((r) => {
    const dest = getDestination(r.destId);
    return {
      ...r,
      stale: !isFresh(r),
      lat: dest?.location?.lat ?? null,
      lng: dest?.location?.lng ?? null,
    };
  });
}
