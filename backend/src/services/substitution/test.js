import dotenv from 'dotenv';
import { connectDB } from '../../lib/db.js';
import { getAlternatives } from './alternatives.service.js';

dotenv.config();

// Mock Pressure Function Data
const mockPressureMap = {
  manali: {
    '2026-12-26': 0.91,
    '2026-12-27': 0.88,
    '2026-12-28': 0.85,
    '2026-12-19': 0.52,
    '2026-12-20': 0.48,
    '2026-12-21': 0.50
  },
  jibhi: {
    '2026-12-26': 0.35,
    '2026-12-27': 0.38
  },
  'tirthan-valley': {
    '2026-12-26': 0.30,
    '2026-12-27': 0.32
  },
  kasol: {
    '2026-12-26': 0.70,
    '2026-12-27': 0.72
  },
  shimla: {
    '2026-12-26': 0.89,
    '2026-12-27': 0.86
  },
  dharamshala: {
    '2026-12-26': 0.55
  },
  hyderabad: {
    '2026-12-26': 0.40
  }
};

async function pressureFn(destId, date) {
  const id = typeof destId === 'object' ? destId._id || destId.id : destId;
  if (mockPressureMap[id] && mockPressureMap[id][date] !== undefined) {
    return mockPressureMap[id][date];
  }
  return 0.50;
}

// Mock Travel Time Function Data
const mockTravelTimeMap = {
  manali: 12,
  shimla: 7,
  'tirthan-valley': 14,
  jibhi: 13,
  kasol: 12,
  dharamshala: 10,
  hyderabad: 26
};

async function travelTimeFn(origin, destId) {
  const id = typeof destId === 'object' ? destId._id || destId.id : destId;
  return mockTravelTimeMap[id] ?? 10;
}

// Mock Budget Function Data
const mockBudgetMap = {
  manali: { stayCost: 5000, transportCost: 2000, total: 7000 },
  shimla: { stayCost: 4500, transportCost: 1500, total: 6000 },
  jibhi: { stayCost: 2500, transportCost: 1500, total: 4000 },
  'tirthan-valley': { stayCost: 2800, transportCost: 1600, total: 4400 },
  kasol: { stayCost: 3000, transportCost: 1800, total: 4800 },
  dharamshala: { stayCost: 3500, transportCost: 1700, total: 5200 },
  hyderabad: { stayCost: 4000, transportCost: 3000, total: 7000 }
};

async function budgetFn(destId, date, travellers = 2) {
  const id = typeof destId === 'object' ? destId._id || destId.id : destId;
  if (mockBudgetMap[id]) {
    return mockBudgetMap[id];
  }
  return { stayCost: 3000, transportCost: 1000, total: 4000 };
}

/**
 * Executes a sample end-to-end test run of the substitution engine pipeline.
 */
async function runTest() {
  console.log('=== Starting Substitution Engine Test ===\n');

  try {
    await connectDB();
  } catch (err) {
    console.log('DB Connection Note:', err.message);
  }

  const request = {
    origin: 'New Delhi',
    destId: 'manali',
    startDate: '2026-12-26',
    endDate: '2026-12-28',
    travellers: 2,
    budgetINR: 15000,
    interests: { snow: 0.8, trek: 0.6, food: 0.4 }
  };

  const result = await getAlternatives(
    request,
    pressureFn,
    travelTimeFn,
    budgetFn,
    0.65
  );

  console.log('\n=== Substitution Engine Test Results ===\n');
  console.log('1. Requested Destination Info:');
  console.log(JSON.stringify(result.requested, null, 2));

  console.log('\n2. Place Alternatives (Top 3):');
  console.table(result.places);

  console.log('\n3. Date Alternatives (Top 2):');
  console.table(result.dates);

  console.log(`\n4. Relaxed Relief Applied: ${result.relaxedRelief}`);

  process.exit(0);
}

runTest().catch((err) => {
  console.error('Test Execution Error:', err);
  process.exit(1);
});
