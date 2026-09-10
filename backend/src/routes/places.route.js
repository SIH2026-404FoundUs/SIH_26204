import express from "express";
import { fail } from "../lib/envelope.js";
import { searchPlaces, getPlacePhoto } from "../providers/googlemaps.provider.js";

const router = express.Router();

router.get("/photo", async (req, res) => {
  const { name, maxWidthPx } = req.query;
  if (!name || !String(name).startsWith("places/")) {
    return res.status(400).json(fail("a valid Google Place photo name is required"));
  }
  try {
    const photo = await getPlacePhoto(String(name), Math.min(Number(maxWidthPx) || 800, 1600));
    res.set("Cache-Control", "public, max-age=86400");
    res.type(photo.contentType).send(photo.data);
  } catch (error) {
    res.status(502).json(fail(error.message || "Could not load place photo"));
  }
});

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
