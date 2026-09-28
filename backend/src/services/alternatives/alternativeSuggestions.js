import AlternativeSuggestion from "../../models/alternativeSuggestion.model.js";
import { logger } from "../../lib/logger.js";

// Persists every option the substitution engine offered on one trip draft --
// called right after createTripController creates the Trip, from the same
// _draftAlternatives payload ai-service already sent (shape: spec's
// AlternativesInfo -- {requested, places:[...], dates:[...], relaxedRelief}).
// Best-effort: a failure here must never fail trip-draft creation itself,
// since the trip's own _draftAlternatives field already holds this data as
// the source of truth for /confirm -- this collection is an additional,
// queryable record of it, not a dependency anything else reads from yet.
export async function saveOfferedAlternatives(trip, alternatives) {
  if (!alternatives || typeof alternatives !== "object") return;

  const docs = [];

  for (const place of Array.isArray(alternatives.places) ? alternatives.places : []) {
    if (!place?.destId) continue;
    docs.push({
      tripId: String(trip._id),
      userId: trip.userId,
      requestedDestId: trip.requestedDestId,
      kind: "place",
      suggestedDestId: place.destId,
      pressure: typeof place.pressure === "number" ? place.pressure : null,
      savingINR: typeof place.savingINR === "number" ? place.savingINR : 0,
      details: place,
    });
  }

  for (const dateOption of Array.isArray(alternatives.dates) ? alternatives.dates : []) {
    if (!dateOption?.startDate) continue;
    docs.push({
      tripId: String(trip._id),
      userId: trip.userId,
      requestedDestId: trip.requestedDestId,
      kind: "date",
      suggestedStartDate: dateOption.startDate,
      pressure: typeof dateOption.pressure === "number" ? dateOption.pressure : null,
      savingINR: typeof dateOption.savingINR === "number" ? dateOption.savingINR : 0,
      details: dateOption,
    });
  }

  if (docs.length === 0) return;

  try {
    await AlternativeSuggestion.insertMany(docs, { ordered: false });
  } catch (error) {
    logger.error("Error saving offered alternatives:", error);
  }
}

// Called from updateTripController the moment an update actually sets
// redistribution.kind to "place"/"date" -- marks whichever previously-saved
// suggestion matches what the trip document says was chosen (redirectedToDestId
// for a place pick, finalDates.startDate for a date pick). Matching on the
// trip's own already-validated fields rather than trusting anything in the
// request body directly -- main.py's match_offer already confirmed the pick
// was actually among what was offered before this ever gets called.
export async function markAcceptedAlternative(trip) {
  const kind = trip?.redistribution?.kind;
  if (kind !== "place" && kind !== "date") return;

  const query = { tripId: String(trip._id), kind };
  if (kind === "place") {
    if (!trip.redirectedToDestId) return;
    query.suggestedDestId = trip.redirectedToDestId;
  } else {
    const startDate = trip.finalDates?.startDate;
    if (!startDate) return;
    query.suggestedStartDate = startDate;
  }

  try {
    await AlternativeSuggestion.updateOne(query, { $set: { accepted: true, acceptedAt: new Date() } });
  } catch (error) {
    logger.error("Error marking accepted alternative:", error);
  }
}
