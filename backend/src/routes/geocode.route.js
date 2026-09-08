import express from "express";
import { fail } from "../lib/envelope.js";
import { geocode } from "../providers/geocode.provider.js";

const router = express.Router();

router.get("/", async (req, res) => {
  const { address } = req.query;

  if (!address) return res.status(400).json(fail("address is required"));

  const result = await geocode(address);
  res.json(result);
});

export default router;
