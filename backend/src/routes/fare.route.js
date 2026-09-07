import express from "express";
import { fail } from "../lib/envelope.js";
import { estimate } from "../providers/fareEstimator.provider.js";

const router = express.Router();

router.get("/", (req, res) => {
  const { city, mode, distanceKm, durationMin } = req.query;

  if (!city) return res.status(400).json(fail("city is required"));
  if (!mode) return res.status(400).json(fail("mode is required"));
  if (!distanceKm) return res.status(400).json(fail("distanceKm is required"));

  const result = estimate(city, mode, Number(distanceKm), durationMin !== undefined ? Number(durationMin) : 0);
  res.json(result);
});

export default router;
