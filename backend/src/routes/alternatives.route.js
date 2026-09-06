// backend/src/routes/alternatives.route.js
import express from 'express';
import { getAlternatives } from '../services/substitution/alternatives.service.js';
import { getPressure } from '../services/pressure/service.js'; // confirm exact export name
import { travelTimeFn } from '../services/travelTime.js';
import { tempBudgetFn } from '../services/tempBudgetFn.js';

const router = express.Router();

router.post('/', async (req, res) => {
  const { origin, destId, startDate, endDate, travellers, budgetINR, interests } = req.body;
  if (!origin || !destId || !startDate || !endDate) {
    return res.status(400).json({ ok: false, error: 'origin, destId, startDate, endDate are required' });
  }

  const result = await getAlternatives(
    { origin, destId, startDate, endDate, travellers, budgetINR, interests },
    getPressure,
    travelTimeFn,
    tempBudgetFn,
    0.65 // dStar, matching her test.js default
  );

  res.json(result);
});

export default router;