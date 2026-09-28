// Thin wrapper over console so every error log keeps its stack trace --
// `console.log(error.message)` (what most controllers did) drops it, which
// makes a production 500 nearly impossible to trace back to a line.
// Deliberately not a dependency (pino/winston): one place to swap later,
// same call sites.
const stamp = () => new Date().toISOString();

function describe(err) {
  if (err instanceof Error) return err.stack || `${err.name}: ${err.message}`;
  return typeof err === "string" ? err : JSON.stringify(err);
}

export const logger = {
  info: (msg, ...rest) => console.log(`[${stamp()}] INFO ${msg}`, ...rest),
  warn: (msg, ...rest) => console.warn(`[${stamp()}] WARN ${msg}`, ...rest),
  error: (msg, err) => console.error(`[${stamp()}] ERROR ${msg}${err !== undefined ? `\n${describe(err)}` : ""}`),
};
