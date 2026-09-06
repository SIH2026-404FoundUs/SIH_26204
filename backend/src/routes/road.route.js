import express from "express";
import { fail } from "../lib/envelope.js";
import { getRoadFrequency } from "../providers/roadtransport.provider.js";

const router = express.Router();

router.get("/", (req, res) => {
  const { destId } = req.query;

  if (!destId) return res.status(400).json(fail("destId is required"));

  const result = getRoadFrequency(destId);
  res.json(result);
});

export default router;
