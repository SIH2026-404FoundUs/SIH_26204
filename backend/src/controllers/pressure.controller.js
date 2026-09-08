import { getPressure, getPressureMap } from "../services/pressure/service.js";

// QA finding (brutal-qa-report.md, P1): date="notadate" and date="2026-13-45"
// were both accepted, computed against, and PERSISTED as real-looking
// pressure rows (confirmed live via direct DB read) -- reproduced through
// both endpoints below, and separately through POST /api/plan-trip's
// internal pressure-gate call, which corrupted a real TRIPS draft. Nothing
// upstream of these controllers ever checks that `date` parses to a real
// calendar date before it's used as a Mongo key and fed into `new Date()`.
//
// `new Date("2026-13-45")` doesn't throw -- it silently rolls the
// out-of-range month/day over into a different (valid) date, so `isNaN` on
// its own doesn't catch this class of input. Round-tripping through
// toISOString and comparing back to the original string does: a genuinely
// valid YYYY-MM-DD is stable under that round trip, a rolled-over one isn't.
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function isValidCalendarDate(date) {
  if (typeof date !== "string" || !DATE_RE.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === date;
}

// GET /api/v1/pressure/:destId?date=YYYY-MM-DD  (spec §10)
export const getPressureController = async (req, res) => {
  try {
    const { destId } = req.params;
    const { date } = req.query;
    if (!date) return res.status(400).json({ message: "date query param required (YYYY-MM-DD)" });
    if (!isValidCalendarDate(date)) {
      return res.status(400).json({ message: "date must be a real calendar date in YYYY-MM-DD format" });
    }

    const row = await getPressure(destId, date);
    if (!row) return res.status(404).json({ message: "unknown destId and no stored row" });
    res.status(200).json(row);
  } catch (error) {
    console.log("Error in getPressure controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// GET /api/v1/pressure/map?date=YYYY-MM-DD  (spec §10)
export const getPressureMapController = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ message: "date query param required (YYYY-MM-DD)" });
    if (!isValidCalendarDate(date)) {
      return res.status(400).json({ message: "date must be a real calendar date in YYYY-MM-DD format" });
    }

    res.status(200).json(await getPressureMap(date));
  } catch (error) {
    console.log("Error in getPressureMap controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
