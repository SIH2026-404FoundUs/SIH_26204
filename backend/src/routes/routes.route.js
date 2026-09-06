import express from "express";
import { fail } from "../lib/envelope.js";
import { calculateRoute } from "../providers/googlemaps.provider.js";

const router = express.Router();

router.post("/", async (req, res) => {
  const { originLat, originLng, destLat, destLng, mode } = req.body;

  if (originLat === undefined) return res.status(400).json(fail("originLat is required"));
  if (originLng === undefined) return res.status(400).json(fail("originLng is required"));
  if (destLat === undefined) return res.status(400).json(fail("destLat is required"));
  if (destLng === undefined) return res.status(400).json(fail("destLng is required"));

  const result = await calculateRoute(
    Number(originLat),
    Number(originLng),
    Number(destLat),
    Number(destLng),
    mode
  );
  res.json(result);
});

export default router;
