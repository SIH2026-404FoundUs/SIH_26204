import express from "express";
import { fail } from "../lib/envelope.js";
import { getTrainAvailability } from "../providers/railradar.provider.js";

const router = express.Router();

router.get("/", async (req, res) => {
  const { trainNumber, source, destination, journeyDate, classCode, quotaCode } = req.query;

  if (!trainNumber) return res.status(400).json(fail("trainNumber is required"));
  if (!source) return res.status(400).json(fail("source is required"));
  if (!destination) return res.status(400).json(fail("destination is required"));
  if (!journeyDate) return res.status(400).json(fail("journeyDate is required"));

  const result = await getTrainAvailability(
    trainNumber,
    source,
    destination,
    journeyDate,
    classCode,
    quotaCode
  );
  res.json(result);
});

export default router;
