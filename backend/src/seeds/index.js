import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "destinations");
let cache;

export async function loadDestinations() {
  if (!cache) {
    cache = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
  }
  return cache;
}

export async function getDestination(id) {
  return (await loadDestinations()).find((d) => d._id === id) || null;
}

export { calendarRow } from "./calendar.js";
