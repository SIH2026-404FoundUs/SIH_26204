import Business from "../models/business.model.js";
import { getPressure } from "../services/pressure/service.js";
import { rankBusinessesForGrowth } from "../services/feedback/growthRanking.js";

const today = () => new Date().toISOString().slice(0, 10);

// Same "low pressure" cutoff Bharani's eligibleForDiscount() uses (spec: pressure < 0.30),
// reused here rather than inventing a second threshold for the same concept.
const LOW_PRESSURE_THRESHOLD = 0.3;

// GET /api/v1/businesses/search?destId=&type=
// Wraps Business.find() + the existing growthRanking formula (spec §3.4) — no
// second ranking implementation. This is the only current consumer of
// rankBusinessesForGrowth(); it was previously correct but wired to nothing.
export const searchBusinessesController = async (req, res) => {
  try {
    const { destId, type } = req.query;
    if (!destId) return res.status(400).json({ message: "destId query param required" });

    const filter = { destId };
    if (type) filter.type = type;
    const businesses = await Business.find(filter).lean();

    const pressureRow = await getPressure(destId, today());
    const isInLowPressureDest =
      typeof pressureRow?.score === "number" && pressureRow.score < LOW_PRESSURE_THRESHOLD;

    const ranked = rankBusinessesForGrowth(businesses, { isInLowPressureDest });
    res.status(200).json(ranked);
  } catch (error) {
    console.log("Error in searchBusinesses controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
