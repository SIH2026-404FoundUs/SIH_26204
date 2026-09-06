// backend/src/services/tempBudgetFn.js
// TEMPORARY — Bharani's real budget function does not exist yet.
// Matches the exact shape of her mock in substitution/test.js.
// Replace with her real implementation once it exists — do not let
// this quietly become the permanent answer.

const mockBudgetMap = {
  manali: { stayCost: 5000, transportCost: 2000, total: 7000 },
  shimla: { stayCost: 4500, transportCost: 1500, total: 6000 },
  jibhi: { stayCost: 2500, transportCost: 1500, total: 4000 },
  'tirthan-valley': { stayCost: 2800, transportCost: 1600, total: 4400 },
  kasol: { stayCost: 3000, transportCost: 1800, total: 4800 },
  dharamshala: { stayCost: 3500, transportCost: 1700, total: 5200 },
  hyderabad: { stayCost: 4000, transportCost: 3000, total: 7000 }
};

export async function tempBudgetFn(destId, date, travellers = 2) {
  if (mockBudgetMap[destId]) return mockBudgetMap[destId];
  return { stayCost: 3000, transportCost: 1000, total: 4000 };
}