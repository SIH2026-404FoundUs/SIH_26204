import mongoose from "mongoose";

// TRIPS — spec §6. Previously only existed as an honestly-labeled process-local
// stub in ai-service/app/services/trip_drafts.py ("lost on restart, not shared
// between workers... swap the body for a DB call and callers do not change").
// This is that DB call's target.
const tripSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    origin: { type: String },
    requestedDestId: { type: String, required: true }, // Ananya's canonical slug
    redirectedToDestId: { type: String, default: null }, // canonical slug, or null if not redirected
    requestedDates: {
      startDate: String,
      endDate: String,
    },
    finalDates: {
      startDate: String,
      endDate: String,
    },
    travellers: { type: Number },
    budgetINR: { type: Number },
    interests: { type: mongoose.Schema.Types.Mixed, default: {} },
    selectedHotel: { type: mongoose.Schema.Types.Mixed },
    stops: { type: [mongoose.Schema.Types.Mixed], default: [] },
    itinerary: { type: mongoose.Schema.Types.Mixed },
    transport: { type: mongoose.Schema.Types.Mixed },
    costBreakdown: { type: mongoose.Schema.Types.Mixed },
    redistribution: {
      kind: { type: String, enum: ["place", "date", "none"], default: "none" },
      pressureBefore: { type: Number, default: null },
      pressureAfter: { type: Number, default: null },
      savingINR: { type: Number, default: 0 },
    },
    alternativesOffered: { type: Boolean, default: false },
    shareToken: { type: String, default: null },
    state: {
      type: String,
      enum: ["draft", "planned", "confirmed", "completed", "cancelled"],
      default: "draft",
    },
    // Internal to the plan/confirm handshake, not part of the locked §6 shape:
    // the pressure reading and offered alternatives captured when a draft is
    // created, so /confirm can rebuild against what was actually offered
    // instead of trusting the client to echo it back.
    _draftPressure: { type: mongoose.Schema.Types.Mixed },
    _draftAlternatives: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

tripSchema.index({ userId: 1, createdAt: -1 });
tripSchema.index({ requestedDestId: 1 });

const Trip = mongoose.model("Trip", tripSchema, "trips");
export default Trip;
