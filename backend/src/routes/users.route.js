import express from "express";
import { protectRouteOrService } from "../middleware/serviceAuth.middleware.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getUserPreferencesController, updateUserPreferencesController } from "../controllers/users.controller.js";

const router = express.Router();

router.get("/:id/preferences", protectRouteOrService, getUserPreferencesController);
// Editing is browser-only (a real signed-in traveller changing their own
// preferences), never the internal service -- protectRoute, not
// protectRouteOrService.
router.patch("/:id/preferences", protectRoute, updateUserPreferencesController);

export default router;
