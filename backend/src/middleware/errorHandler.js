import { logger } from "../lib/logger.js";

// Unmatched /api route -> JSON 404 (Express's default is an HTML page, which
// the frontend's `error.response.data.message` lookup can't read).
export function notFoundHandler(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// Central error middleware. Express 5 forwards rejected async handlers here
// automatically, so a controller no longer needs its own try/catch just to
// avoid a hung request -- it can throw and this answers. 4xx errors (bad
// JSON body, oversized payload, rejected CORS origin) keep their own status
// and message; anything else is a real fault: full stack goes to the log,
// the client only ever sees a generic message.
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const status = err.status || err.statusCode || (err.name === "MulterError" ? 400 : 500);
  if (status >= 500) {
    logger.error(`${req.method} ${req.originalUrl} failed`, err);
    return res.status(status).json({ message: "Internal Server Error" });
  }
  res.status(status).json({ message: err.message || "Bad request" });
}
