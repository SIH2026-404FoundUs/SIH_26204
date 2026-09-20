import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/requireRole.js";
import { getMyPostedGigsController } from "../controllers/gigs.controller.js";

// Worker role design spec §05: GET /v1/operators/me/gigs specifically, its
// own tiny router rather than folding it into businesses.route.js -- this
// is about gigs an operator posted, not businesses they own.
const router = express.Router();

router.use(protectRoute, requireRole("operator"));
router.get("/me/gigs", getMyPostedGigsController);

export default router;
