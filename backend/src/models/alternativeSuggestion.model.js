import mongoose from "mongoose";

// alternative_suggestions — every alternative destination/date the
// substitution engine offered a traveller, one document per option, kept
// even for the ones never picked. Previously this only lived buried inside
// each Trip's own _draftAlternatives blob (still written, unchanged, for
// /confirm's own rebuild-against-what-was-offered check) -- this collection
// exists specifically so "what gets recommended, and does anyone take it"
// is queryable on its own, without parsing every trip's Mixed field.
//
// Written by trips.controller.js's createTripController the moment a trip
// draft carries _draftAlternatives; `accepted` flips true from
// updateTripController the moment that trip's own redistribution.kind
// confirms this exact option was the one chosen. Never written by the AI
// service directly -- ai-service never touches Mongo, only the Express
// backend does (see backend_client.py).
const alternativeSuggestionSchema = new mongoose.Schema(
  {
    tripId: { type: String, required: true }, // the Trip._id this offer belongs to
    userId: { type: String, required: true },
    requestedDestId: { type: String, required: true }, // what the traveller originally asked for
    kind: { type: String, enum: ["place", "date"], required: true },
    // Exactly one of these is set, matching `kind`.
    suggestedDestId: { type: String, default: null }, // canonical slug, kind:"place" only
    suggestedStartDate: { type: String, default: null }, // YYYY-MM-DD, kind:"date" only
    pressure: { type: Number, default: null }, // the alternative's own score at offer time
    savingINR: { type: Number, default: 0 },
    accepted: { type: Boolean, default: false },
    acceptedAt: { type: Date, default: null },
    // The engine's full option object (distance, travel time, cost
    // breakdown, rank, note, ...) -- kept verbatim rather than re-declaring
    // every field here, since Madhuri's substitution engine's own output
    // shape is free to keep evolving without a migration on this side.
    details: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true } // createdAt IS "offered at" -- these are written once, at offer time
);

alternativeSuggestionSchema.index({ tripId: 1 });
alternativeSuggestionSchema.index({ userId: 1, createdAt: -1 });
alternativeSuggestionSchema.index({ suggestedDestId: 1 });
alternativeSuggestionSchema.index({ accepted: 1 });

const AlternativeSuggestion = mongoose.model(
  "AlternativeSuggestion",
  alternativeSuggestionSchema,
  "alternative_suggestions"
);
export default AlternativeSuggestion;
