// Calendar table — spec §3. Keyed by date + state. Ananya owns the real
// seeds/calendar.json; this is a placeholder covering the demo window + the
// back-test past dates. engine.calendar() maps kind -> value.

const FESTIVALS = {
  "2025-12-25": { kind: "national", label: "christmas" },
  "2025-12-26": { kind: "national", label: "christmas-week" },
  "2026-01-01": { kind: "national", label: "new-year" },
  "2026-08-15": { kind: "national", label: "independence-day" },
  "2026-10-02": { kind: "national", label: "gandhi-jayanti" },
  "2026-10-19": { kind: "state", label: "kullu-dussehra", state: "HP" },
  "2026-10-20": { kind: "national", label: "dussehra" },
  "2026-11-08": { kind: "national", label: "diwali" },
};

export function calendarRow({ date, state }) {
  const f = FESTIVALS[date];
  if (f && (!f.state || f.state === state)) return { kind: f.kind, label: f.label };
  const day = new Date(date + "T00:00:00Z").getUTCDay();
  if (day === 0 || day === 6) return { kind: "weekend", label: "weekend" };
  return { kind: "weekday", label: "weekday" }; // default when no row matches
}
