import express from "express";
import { fail } from "../lib/envelope.js";
import { searchPlaces } from "../providers/googlemaps.provider.js";

const router = express.Router();

router.get("/", async (req, res) => {
  const { query, lat, lng, radiusMeters } = req.query;

  if (!query) return res.status(400).json(fail("query is required"));
  if (!lat) return res.status(400).json(fail("lat is required"));
  if (!lng) return res.status(400).json(fail("lng is required"));

  const result = await searchPlaces(
    query,
    Number(lat),
    Number(lng),
    radiusMeters !== undefined ? Number(radiusMeters) : undefined
  );
  res.json(result);
});

export default router;
