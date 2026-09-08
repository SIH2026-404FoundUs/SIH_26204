// pollAlerts.job.js only ran as a manual CLI script -- nothing in the running
// server ever invoked it, so in a normal deployment the alerts collection
// stayed empty forever and GET /api/v1/alerts always returned []. This wires
// it into the actual server process: once on startup (so a fresh deploy has
// data immediately) and then on a fixed interval.
import { runPollAlerts } from "./pollAlerts.job.js";
import { loadDestinations } from "../services/pressure/seed.js";
import Alert from "../models/alert.model.js";
import AuditLog from "../models/auditLog.model.js";

const POLL_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6h -- Open-Meteo forecasts don't change fast enough to justify polling more often

export function startAlertPolling() {
  const models = { AlertModel: Alert, AuditLogModel: AuditLog };

  const run = async () => {
    try {
      const result = await runPollAlerts(loadDestinations(), models);
      console.log("[alerts] poll run:", result);
    } catch (error) {
      // A failed poll (e.g. Open-Meteo down) must never crash the server --
      // alerts are best-effort advisory data, not a critical path.
      console.log("[alerts] poll run failed:", error.message);
    }
  };

  run();
  const timer = setInterval(run, POLL_INTERVAL_MS);
  timer.unref?.(); // don't hold the process open just for this timer
  return timer;
}
