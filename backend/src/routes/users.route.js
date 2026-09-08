import express from "express";
import { getUserPreferencesController } from "../controllers/users.controller.js";

const router = express.Router();

router.get("/:id/preferences", getUserPreferencesController);

export default router;
