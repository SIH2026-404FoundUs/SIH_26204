import crypto from "crypto";
import { protectRoute } from "./auth.middleware.js";

// Internal service calls are separate from browser sessions. They are still
// authenticated, so an external caller cannot use the AI persistence seam to
// read or mutate arbitrary trip records.
export const protectRouteOrService = async (req, res, next) => {
  const supplied = req.get("x-internal-service-token");
  const expected = process.env.INTERNAL_SERVICE_TOKEN;

  if (supplied && expected) {
    const suppliedBuffer = Buffer.from(supplied);
    const expectedBuffer = Buffer.from(expected);
    if (
      suppliedBuffer.length === expectedBuffer.length
      && crypto.timingSafeEqual(suppliedBuffer, expectedBuffer)
    ) {
      req.isInternalService = true;
      return next();
    }
  }

  return protectRoute(req, res, next);
};
