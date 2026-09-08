// backend/src/routes/alternatives.route.js
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getAlternatives } from '../services/substitution/alternatives.service.js';
import { getPressure } from '../services/pressure/service.js';
import { travelTimeFn } from '../services/travelTime.js';
import { calculateBudget } from '../services/budgetService.js';
import { getDestinationById } from '../services/substitution/standardize.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HISTOGRAM_PATH = path.join(__dirname, '../../../build/distance-histogram.json');

const getCalibratedDStar = () => {
  try {
    if (fs.existsSync(HISTOGRAM_PATH)) {
      const data = JSON.parse(fs.readFileSync(HISTOGRAM_PATH, 'utf8'));
      if (typeof data.calibratedDStar === 'number') {
        return data.calibratedDStar;
      }
    }
  } catch (e) {
    // fallback
  }
  return 1.15;
};

const router = express.Router();

const destIdOf = (dest) =>
  dest && typeof dest === 'object' ? dest._id || dest.id : dest;

const UNKNOWN_PRESSURE = 1;
const pressureFn = async (dest, date) => {
  const row = await getPressure(destIdOf(dest), date);
  return row?.score ?? UNKNOWN_PRESSURE;
};

/** Dynamic destination budget estimator using budgetService and seeded baselines */
const budgetFn = async (dest, date, travellers = 2) => {
  const id = destIdOf(dest);
  const destDoc = getDestinationById(id);
  const medianPrice = destDoc?.baseline?.hotelMedianINR || 3500;
  const days = 2;
  const pricePerPersonPerDay = 600;
  const transportEst = destDoc?.railheadDistanceKm
    ? Math.min(5000, Math.max(1000, Math.round(destDoc.railheadDistanceKm * 8)))
    : 1500;

  const calculated = calculateBudget({
    destId: id,
    travellers: travellers || 2,
    days,
    budgetINR: 12000,
    hotel: { pricePerNight: medianPrice, nights: days, rooms: 1, source: 'seeded' },
    transport: { totalCost: transportEst, source: 'estimated' },
    food: { pricePerPersonPerDay, source: 'estimated' }
  });

  const stayCost = calculated.costBreakdown.hotel.amount;
  const transportCost = calculated.costBreakdown.transport.amount;
  const total = calculated.totalCost;

  return { stayCost, transportCost, total, costBreakdown: calculated.costBreakdown };
};

/** Safe travel time wrapper ensuring Geocode API Key alias */
const reachabilityFn = async (origin, dest) => {
  if (!process.env.GOOGE_GEOCODE_API_KEY && process.env.GOOGLE_MAPS_API_KEY) {
    process.env.GOOGE_GEOCODE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
  }
  return travelTimeFn(origin, destIdOf(dest));
};

router.post('/', async (req, res) => {
  const { origin, destId, startDate, endDate, travellers, budgetINR, interests } = req.body;
  if (!origin || !destId || !startDate || !endDate) {
    return res.status(400).json({ ok: false, error: 'origin, destId, startDate, endDate are required' });
  }

  // QA finding (brutal-qa-report.md, P1): destId="fake-xyz" (not a tracked
  // destination at all) returned a fully-formed, entirely fabricated
  // response -- pressure 0.5 across every component -- rather than an
  // error. Root cause was the `?? 0.5` fallbacks below, which exist to
  // handle a *candidate* destination's pressure being momentarily
  // unavailable, but were also firing for the *requested* destination not
  // existing at all. Reject that case up front, the same way
  // GET /api/v1/pressure/:destId already does, instead of letting the rest
  // of this pipeline invent a plausible-looking profile for it.
  if (!getDestinationById(destId)) {
    return res.status(404).json({ ok: false, error: `unknown destId: ${destId}` });
  }

  try {
    const pressureFnWrapper = async (id, date) => {
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
      pressureFnWrapper,
      reachabilityFn,
      budgetFn,
      getCalibratedDStar()
    );

    res.json(result);
  } catch (error) {
    console.log('Error in alternatives route', error.message);
    res.status(500).json({ ok: false, error: 'Internal Server Error' });
  }
});

export default router;