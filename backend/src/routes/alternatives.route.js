// backend/src/routes/alternatives.route.js
import express from 'express';
import { getAlternatives } from '../services/substitution/alternatives.service.js';
import { getPressure } from '../services/pressure/service.js';
import { travelTimeFn } from '../services/travelTime.js';
import { tempBudgetFn } from '../services/tempBudgetFn.js';

const router = express.Router();

// --- Adapters between the real services and what the substitution engine expects.
// The engine calls these with a plain string destId and assumes a plain number
// back. The real services don't satisfy that contract on their own, so bridge it
// here at the composition root rather than bending either side.

/** filters.js passes whole destination documents where the services want an id. */
const destIdOf = (dest) =>
  dest && typeof dest === 'object' ? dest._id || dest.id : dest;

// getPressure resolves to the full destination_pressure row, or null when the
// destination isn't tracked at all. The engine wants just the 0..1 scalar.
// `score` is also legitimately null when every pressure component failed to
// compute — that means "unknown", NOT zero crowding. Both cases are treated as
// maximum pressure so an unknown destination gets filtered out rather than
// recommended as relief; scoring it 0 would do the opposite.
const UNKNOWN_PRESSURE = 1;
const pressureFn = async (dest, date) => {
  const row = await getPressure(destIdOf(dest), date);
  return row?.score ?? UNKNOWN_PRESSURE;
};

const reachabilityFn = (origin, dest) => travelTimeFn(origin, destIdOf(dest));

const budgetFn = (dest, date, travellers) =>
  tempBudgetFn(destIdOf(dest), date, travellers);

router.post('/', async (req, res) => {
  const { origin, destId, startDate, endDate, travellers, budgetINR, interests } = req.body;
  if (!origin || !destId || !startDate || !endDate) {
    return res.status(400).json({ ok: false, error: 'origin, destId, startDate, endDate are required' });
  }

  try {
    const result = await getAlternatives(
      { origin, destId, startDate, endDate, travellers, budgetINR, interests },
      pressureFn,
      reachabilityFn,
      budgetFn,
      0.65 // dStar, matching her test.js default
    );

    res.json(result);
  } catch (error) {
    console.log('Error in alternatives route', error.message);
    res.status(500).json({ ok: false, error: 'Internal Server Error' });
  }
});

export default router;