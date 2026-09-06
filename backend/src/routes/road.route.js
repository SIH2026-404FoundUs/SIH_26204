import express from "express";
import { fail } from "../lib/envelope.js";
import { getRoadFrequency } from "../providers/roadtransport.provider.js";

const router = express.Router();

// No destinations seed with roadAccess/baseline data exists yet, so this
// takes the destination object directly in the body rather than looking
// one up by an id — avoids depending on seed data owned by another teammate.
router.get("/", (req, res) => {
  const { destination } = req.query;

  if (!destination) return res.status(400).json(fail("destination is required"));

  const result = getRoadFrequency(destination);
  res.json(result);
});

export default router;
