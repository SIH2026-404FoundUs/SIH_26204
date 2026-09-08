import express from "express";
import { protectRouteOrService } from "../middleware/serviceAuth.middleware.js";
import { getUserPreferencesController } from "../controllers/users.controller.js";

const router = express.Router();

router.get("/:id/preferences", protectRouteOrService, getUserPreferencesController);

export default router;
