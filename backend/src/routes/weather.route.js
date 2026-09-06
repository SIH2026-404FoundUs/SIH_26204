import express from "express";
import { fail } from "../lib/envelope.js";
import { getForecast } from "../providers/openmeteo.provider.js";

const router = express.Router();

router.get("/", async (req, res) => {
  const { lat, lng, date } = req.query;

  if (!lat) return res.status(400).json(fail("lat is required"));
  if (!lng) return res.status(400).json(fail("lng is required"));
  if (!date) return res.status(400).json(fail("date is required"));

  const result = await getForecast(Number(lat), Number(lng), date);
  res.json(result);
});

export default router;
