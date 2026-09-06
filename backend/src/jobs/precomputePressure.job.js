// Spec §7 — nightly precompute into destination_pressure.
// Demo-corridor destinations (seed flag `demoCorridor`) get a 45-day forward
// window; the rest get 14 days. All get `backfillDays` of PAST dates too.
//
// The 30-day backfill produces history for §8 (emerging hotspot + capacity gap).
// Ananya's seeds/pressure_history.json also seeds destination_pressures, but its
// rows use non-§2 weights (access 0.35 / weather 0.15 / capacity 0.15), so this
// job re-computes history with the LOCKED weights and overwrites them. Drop
// `backfillDays` to 0 once that seed is regenerated to spec.
//
// Providers are injected; the CLI runner uses services/pressure/realProviders.js.
// Destination + calendar data comes from Ananya's seed via services/pressure/seed.js.

import { argv } from "node:process";
import { pathToFileURL } from "node:url";
import DestinationPressure from "../models/destinationPressure.model.js";
import { collect } from "../services/pressure/collectors.js";
import { assembleRow } from "../services/pressure/engine.js";
import { calendarRow } from "../services/pressure/seed.js";

const seed = { calendarRow };

const iso = (d) => d.toISOString().slice(0, 10);
function dateRange(days, startOffsetDays = 0) {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + startOffsetDays);
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    return iso(d);
  });
}

/**
 * @param {object[]} dests    full seed dest rows
 * @param {object}   opts     { providers, demoDays?, otherDays?, backfillDays? }
 * @returns {{ written:number, failed:number }}
 */
export async function runPrecompute(dests, { providers, demoDays = 45, otherDays = 14, backfillDays = 0 } = {}) {
  let written = 0;
  let failed = 0;

  for (const dest of dests) {
    const forwardDays = dest.demoCorridor ? demoDays : otherDays;
    for (const date of dateRange(backfillDays + forwardDays, -backfillDays)) {
      try {
        const { values, degradedRoad } = await collect(dest, date, { providers, seed });
        const row = assembleRow(values, { degradedRoad });
        await DestinationPressure.updateOne(
          { destId: dest._id, date },
          { $set: { destId: dest._id, date, ...row, stale: false, computedAt: new Date() } },
          { upsert: true }
        );
        written++;
      } catch (err) {
        console.log(`precompute failed for ${dest._id} ${date}:`, err.message);
        failed++;
      }
    }
  }
  return { written, failed };
}

// --- CLI: `node src/jobs/precomputePressure.job.js` — one pass (30d backfill +
// forward window). Wire runPrecompute() into a real cron for the nightly job.
if (argv[1] && import.meta.url === pathToFileURL(argv[1]).href) {
  const [{ connectDB }, dotenv, { loadDestinations }, { realProviders }] =
    await Promise.all([
      import("../lib/db.js"),
      import("dotenv"),
      import("../services/pressure/seed.js"),
      import("../services/pressure/realProviders.js"),
    ]);
  dotenv.default.config();
  await connectDB();
  // 30-day backfill = temporary Ananya history seed (§8). Nightly cron: pass 0.
  const res = await runPrecompute(await loadDestinations(), {
    providers: realProviders,
    backfillDays: 30,
  });
  console.log("precompute done:", res);
  process.exit(0);
}
