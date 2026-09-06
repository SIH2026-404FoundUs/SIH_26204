import express from "express";
import {
  getPressureController, getPressureMapController,
} from "../controllers/pressure.controller.js";

const router = express.Router();

router.get("/map", getPressureMapController); // before /:destId so "map" isn't an id
router.get("/:destId", getPressureController);

export default router;
