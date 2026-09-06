// backend/src/routes/alternatives.route.js
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getAlternatives } from '../services/substitution/alternatives.service.js';
import { getPressure } from '../services/pressure/service.js';
import { travelTimeFn } from '../services/travelTime.js';
import { tempBudgetFn } from '../services/tempBudgetFn.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HISTOGRAM_PATH = path.join(__dirname, '../../../build/distance-histogram.json');

let calibratedDStar = 0.78;
try {
  if (fs.existsSync(HISTOGRAM_PATH)) {
    const data = JSON.parse(fs.readFileSync(HISTOGRAM_PATH, 'utf8'));
    if (typeof data.calibratedDStar === 'number') {
      calibratedDStar = data.calibratedDStar;
    }
  }
} catch (e) {
  calibratedDStar = 0.78;
}

const router = express.Router();

router.post('/', async (req, res) => {
  const { origin, destId, startDate, endDate, travellers, budgetINR, interests } = req.body;
  if (!origin || !destId || !startDate || !endDate) {
    return res.status(400).json({ ok: false, error: 'origin, destId, startDate, endDate are required' });
  }

  const pressureFn = async (id, date) => {
    const res = await getPressure(id, date);
    if (typeof res === 'number') return { score: res, components: null };
    if (res && typeof res === 'object') {
      return {
        score: res.score ?? 0.5,
        components: res.components || null,
        dateVaryingSubtotal: res.dateVaryingSubtotal,
        staticSubtotal: res.staticSubtotal,
        dropped: res.dropped || [],
        degraded: res.degraded || [],
        lowConfidence: res.lowConfidence || false,
        stale: res.stale || false
      };
    }
    return { score: 0.5, components: null };
  };

  const result = await getAlternatives(
    { origin, destId, startDate, endDate, travellers, budgetINR, interests },
    pressureFn,
    travelTimeFn,
    tempBudgetFn,
    calibratedDStar
  );

  res.json(result);
});

export default router;