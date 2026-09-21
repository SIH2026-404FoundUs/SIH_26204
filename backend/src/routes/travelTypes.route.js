import express from "express";
import { listTravelTypesController, getTravelTypeController } from "../controllers/travelTypes.controller.js";

const router = express.Router();

router.get("/", listTravelTypesController);
router.get("/:type", getTravelTypeController);

export default router;
