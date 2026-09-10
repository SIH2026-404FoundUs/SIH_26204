// Read accessor over Ananya's seed JSON (backend/src/seeds/). She ships the
// data files + a Mongo seeder; this is the file-level read layer the pressure
// engine and back-test share. Lives in the pressure folder so it never collides
// with the seeds/ dir she owns.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SEEDS = join(dirname(fileURLToPath(import.meta.url)), "../../seeds");
const readJSON = (p) => JSON.parse(readFileSync(join(SEEDS, p), "utf8"));

let _dests;
let _calendar;
let _bizCapByDest;

function businessCapacityByDest() {
  if (!_bizCapByDest) {
    _bizCapByDest = {};
    for (const b of readJSON("businesses.json")) {
      _bizCapByDest[b.destId] = (_bizCapByDest[b.destId] ?? 0) + (b.capacity ?? 0);
    }
  }
  return _bizCapByDest;
}

/** All tracked destinations, each enriched with expectedSupply (spec §8) =
 *  sum of seeded business capacity for that dest. */
export function loadDestinations() {
  if (!_dests) {
    const cap = businessCapacityByDest();
    _dests = readdirSync(join(SEEDS, "destinations"))
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        const d = readJSON(`destinations/${f}`);
        return { ...d, expectedSupply: d.expectedSupply ?? cap[d._id] ?? null };
      });
  }
  return _dests;
}

export function getDestination(id) {
  return loadDestinations().find((d) => d._id === id) || null;
}

/** spec §3 calendar lookup. Ananya's rows carry `impact` (0..1) directly, so
 *  the national/state/weekend -> number mapping is already done. Returns the
 *  final { value, label }; weekend/weekday is the default when no row matches. */
export function calendarRow({ date, state }) {
  if (!_calendar) _calendar = readJSON("calendar.json");
  const hit = _calendar.find(
    (r) => r.date === date && (r.state == null || r.state === state)
  );
  if (hit) return { value: hit.impact, label: hit.label };
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  return dow === 0 || dow === 6
    ? { value: 0.4, label: "weekend" }
    : { value: 0.1, label: "weekday" };
}
