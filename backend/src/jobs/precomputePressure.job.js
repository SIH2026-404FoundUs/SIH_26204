// Spec §7 — nightly precompute into destination_pressure.
// Demo-corridor destinations (seed flag `demoCorridor`) get a 45-day window;
// the rest get 14 days.
//
// Providers are injected. Until Nishith's adapters exist, the CLI runner uses
// services/pressure/mockProviders.js. Destination + calendar data is the real
// seed (../seeds).

import { argv } from "node:process";
import { pathToFileURL } from "node:url";
import DestinationPressure from "../models/destinationPressure.model.js";
import { collect } from "../services/pressure/collectors.js";
import { assembleRow } from "../services/pressure/engine.js";
import { calendarRow } from "../seeds/calendar.js";

const seed = { calendarRow };

const iso = (d) => d.toISOString().slice(0, 10);
function dateRange(days, from = new Date()) {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(from);
    d.setUTCDate(d.getUTCDate() + i);
    return iso(d);
  });
}

/**
 * @param {object[]} dests    full seed dest rows
 * @param {object}   opts     { providers, demoDays?, otherDays? }
 * @returns {{ written:number, failed:number }}
 */
export async function runPrecompute(dests, { providers, demoDays = 45, otherDays = 14 } = {}) {
  let written = 0;
  let failed = 0;

  for (const dest of dests) {
    const days = dest.demoCorridor ? demoDays : otherDays;
    for (const date of dateRange(days)) {
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

// --- CLI: `node src/jobs/precomputePressure.job.js` — one pass against the mock
// provider layer. Wire runPrecompute() into a real cron for the nightly job.
if (import.meta.url === pathToFileURL(argv[1]).href) {
  const [{ connectDB }, dotenv, { loadDestinations }, { mockProviders }] =
    await Promise.all([
      import("../lib/db.js"),
      import("dotenv"),
      import("../seeds/index.js"),
      import("../services/pressure/mockProviders.js"),
    ]);
  dotenv.default.config();
  await connectDB();
  const res = await runPrecompute(await loadDestinations(), { providers: mockProviders });
  console.log("precompute done:", res);
  process.exit(0);
}
