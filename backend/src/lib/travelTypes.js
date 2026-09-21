// Travel Types taxonomy (Revised Implementation Plan §6) -- the single
// fixed vocabulary Travel Types, Travel Education tagging, and Group
// Travel matching all validate against. Aligned with the destination
// seed's own attr_* fields (snow/trek/riverside/heritage/nightlife/food/
// wildlife/spiritual, see destinations.route.js's attrs mapping) rather
// than inventing a second, disconnected taxonomy -- a destination already
// "scores" against most of these, so a traveller's travelTypes can
// eventually be matched against real seeded attrs, not a parallel concept.
export const TRAVEL_TYPES = [
  { id: "adventure", label: "Adventure" },
  { id: "nature", label: "Nature" },
  { id: "heritage", label: "Heritage" },
  { id: "slow_travel", label: "Slow Travel" },
  { id: "budget", label: "Budget" },
  { id: "wildlife", label: "Wildlife" },
  { id: "spiritual", label: "Spiritual" },
  { id: "food", label: "Food" },
  { id: "nightlife", label: "Nightlife" },
  { id: "photography", label: "Photography" },
];
export const TRAVEL_TYPE_IDS = TRAVEL_TYPES.map((t) => t.id);

export const PREFERRED_ACTIVITIES = [
  "trekking",
  "camping",
  "photography",
  "food",
  "wildlife",
  "heritage_walks",
  "water_sports",
  "cycling",
  "spiritual_visits",
  "shopping",
];

export const PREFERRED_PACE = ["relaxed", "balanced", "fast_paced"];

// Categorical bands, not raw numbers -- matches the plan's own "Solo / 2-3
// / 4-6 / 7-10 / 10+" phrasing and every other enum-banded preference in
// this schema (budgetBand already works the same way).
export const PREFERRED_GROUP_SIZE = ["solo", "2-3", "4-6", "7-10", "10+"];
export const PREFERRED_TRIP_DURATION = ["1-2", "3-4", "5-7", "8+"];
