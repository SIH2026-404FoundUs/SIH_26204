// A stop is either a visit (its own name) or a hotel day-anchor (name nested
// under `location`), which is the shape optimize_itinerary returns.
export function itineraryStopName(stop) {
  if (!stop || typeof stop !== 'object') return 'Planned stop'
  if (stop.location && typeof stop.location === 'object') return stop.location.name || 'Stay'
  return stop.name || 'Planned stop'
}
