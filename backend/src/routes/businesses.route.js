import express from "express";
import { searchBusinessesController } from "../controllers/businesses.controller.js";

const router = express.Router();

router.get("/search", searchBusinessesController);

export default router;
