// Spec §9 — required deliverable. Produces the one number for the pitch slide:
// does the formula RANK busy destinations above quiet ones?
//
//   node scripts/backtest.js
//
// Metric is Spearman rank correlation, not absolute accuracy (there is no
// ground-truth crowding series for Indian destinations). Working target: the
// median across dates >= 0.6 means the formula orders sensibly.
//
// Runs on mock providers + Ananya's real destination seed (pure, no DB). Swap in
// historical provider values + a real Ministry footfall table before the pitch.

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { collect } from "../backend/src/services/pressure/collectors.js";
import { assembleRow } from "../backend/src/services/pressure/engine.js";
import { spearman } from "../backend/src/services/pressure/stats.js";
import { loadDestinations, calendarRow } from "../backend/src/services/pressure/seed.js";
import { mockProviders, FOOTFALL_PROXY } from "../backend/src/services/pressure/mockProviders.js";

const seed = { calendarRow };

// >=1 peak festival window, >=1 adjacent lean week (spec §9). Festival dates must
// have rows in seeds/calendar.json; the rest fall back to weekday/weekend.
const DATES = [
  { date: "2026-12-10", note: "lean — mid-december weekday" },
  { date: "2026-11-18", note: "lean — mid-november weekday" },
  { date: "2026-09-15", note: "lean — mid-september weekday" },
  { date: "2026-10-20", note: "peak — bathukamma/diwali (TG-only, 0.9)" },
  { date: "2027-01-14", note: "peak — sankranti (TG-only, 0.95)" },
];

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

async function scoreAll(dests, date) {
  const rows = [];
  for (const dest of dests) {
    const { values, degradedRoad } = await collect(dest, date, { providers: mockProviders, seed });
    const { score } = assembleRow(values, { degradedRoad });
    rows.push({ destId: dest._id, score });
  }
  return rows;
}

async function main() {
  // §9: score 8-10 seeded destinations that have an independent footfall figure
  const dests = loadDestinations().filter((d) => FOOTFALL_PROXY[d._id] != null);
  const perDate = [];
  for (const { date, note } of DATES) {
    const scored = await scoreAll(dests, date);
    const computed = scored.map((r) => r.score);
    const footfall = scored.map((r) => FOOTFALL_PROXY[r.destId]);
    const rho = spearman(computed, footfall);
    perDate.push({
      date,
      note,
      spearman: Number(rho.toFixed(3)),
      ranking: [...scored].sort((a, b) => b.score - a.score).map((r) => r.destId),
    });
  }

  const medianRho = Number(median(perDate.map((d) => d.spearman)).toFixed(3));
  const report = {
    generatedAt: new Date().toISOString(),
    source: "mock providers + real destination seed — replace with historical provider values + real footfall table",
    metric: "spearman rank correlation, computed pressure vs independent footfall ordering",
    workingTarget: 0.6,
    medianSpearman: medianRho,
    perDate,
  };

  const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "build");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "backtest-report.json"), JSON.stringify(report, null, 2));

  console.log(`\nbacktest median Spearman = ${medianRho}  (target >= 0.6)`);
  console.table(perDate.map(({ date, note, spearman }) => ({ date, note, spearman })));
  console.log("wrote build/backtest-report.json");
}

main();
