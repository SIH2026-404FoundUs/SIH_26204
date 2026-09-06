import { getPressure, getPressureMap } from "../services/pressure/service.js";

// GET /api/v1/pressure/:destId?date=YYYY-MM-DD  (spec §10)
export const getPressureController = async (req, res) => {
  try {
    const { destId } = req.params;
    const { date } = req.query;
    if (!date) return res.status(400).json({ message: "date query param required (YYYY-MM-DD)" });

    const row = await getPressure(destId, date);
    if (!row) return res.status(404).json({ message: "unknown destId and no stored row" });
    res.status(200).json(row);
  } catch (error) {
    console.log("Error in getPressure controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// GET /api/v1/pressure/map?date=YYYY-MM-DD  (spec §10)
export const getPressureMapController = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ message: "date query param required (YYYY-MM-DD)" });

    res.status(200).json(await getPressureMap(date));
  } catch (error) {
    console.log("Error in getPressureMap controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
