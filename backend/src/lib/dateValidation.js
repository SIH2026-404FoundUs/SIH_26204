// Shared YYYY-MM-DD calendar-date validator. Extracted out of
// pressure.controller.js (its original home, with the full QA backstory
// below preserved) so the new dashboard endpoints can reuse the exact same
// check instead of a second, possibly-drifted copy.
//
// QA finding (brutal-qa-report.md, P1): date="notadate" and date="2026-13-45"
// were both accepted, computed against, and PERSISTED as real-looking
// pressure rows (confirmed live via direct DB read). Nothing upstream of
// these controllers ever checked that `date` parses to a real calendar date
// before it was used as a Mongo key and fed into `new Date()`.
//
// `new Date("2026-13-45")` doesn't throw -- it silently rolls the
// out-of-range month/day over into a different (valid) date, so `isNaN` on
// its own doesn't catch this class of input. Round-tripping through
// toISOString and comparing back to the original string does: a genuinely
// valid YYYY-MM-DD is stable under that round trip, a rolled-over one isn't.
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidCalendarDate(date) {
  if (typeof date !== "string" || !DATE_RE.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === date;
}
