// The functions the rest of the platform calls (spec §11). Madhuri's
// substitution engine and heatmap import getPressure() directly; the HTTP
// controller is a thin wrapper over these.

import DestinationPressure from "../../models/destinationPressure.model.js";
import { getDestination } from "../../seeds/index.js";
import { calendarRow } from "../../seeds/calendar.js";
import { collect } from "./collectors.js";
import { assembleRow } from "./engine.js";
// Until Nishith's provider layer lands, live compute uses the mock adapters.
import { mockProviders } from "./mockProviders.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const LIVE_TIMEOUT_MS = 4000; // spec §7: short budget, never sit on the demo path

const providers = mockProviders; // swap for the real provider module when it exists
const seed = { calendarRow };

const isFresh = (row) => Date.now() - new Date(row.computedAt).getTime() < DAY_MS;
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

  const dest = await getDestination(destId);
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
export async function getPressureMap(date) {
  const rows = await DestinationPressure.find({ date }).lean();
  return rows.map((r) => ({ ...r, stale: !isFresh(r) }));
}
