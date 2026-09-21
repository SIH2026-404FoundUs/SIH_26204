import { TRAVEL_TYPES, PREFERRED_ACTIVITIES, PREFERRED_PACE, PREFERRED_GROUP_SIZE, PREFERRED_TRIP_DURATION } from "../lib/travelTypes.js";

// GET /api/v1/travel-types -- the fixed taxonomy the frontend's Travel
// Types picker renders and preferences.travelTypes/preferredActivities/etc
// validate against server-side. Public, unauthenticated -- same posture as
// GET /api/destinations (a reference list, not user data).
export const listTravelTypesController = (req, res) => {
  res.status(200).json({
    travelTypes: TRAVEL_TYPES,
    preferredActivities: PREFERRED_ACTIVITIES,
    preferredPace: PREFERRED_PACE,
    preferredGroupSize: PREFERRED_GROUP_SIZE,
    preferredTripDuration: PREFERRED_TRIP_DURATION,
  });
};

// GET /api/v1/travel-types/:type -- one travel type's own entry, for a
// destination/education page that wants "what does 'Adventure' mean here"
// without fetching the whole list.
export const getTravelTypeController = (req, res) => {
  const type = TRAVEL_TYPES.find((t) => t.id === req.params.type);
  if (!type) return res.status(404).json({ message: "unknown travel type" });
  res.status(200).json(type);
};
