import mongoose from "mongoose";

// destination_pressure — storage shape from Pressure Engine spec §6.
// One row per (destId, date). Written by the nightly precompute job,
// read by the substitution engine, heatmap, incentive engine and the ADK tool.
const componentSchema = new mongoose.Schema(
  { value: Number, weight: Number, source: String },
  { _id: false, strict: false } // strict:false keeps the per-component extras
);                              // (rail, road, c, unavailFrac, priceRatio, label...)

const pressureSchema = new mongoose.Schema(
  {
    destId: { type: String, required: true }, // Ananya's canonical slug, never a Place ID
    date: { type: String, required: true },   // "YYYY-MM-DD"
    score: { type: Number, required: true },
    components: {
      access: componentSchema,
      stay: componentSchema,
      calendar: componentSchema,
      weather: componentSchema,
      capacity: componentSchema,
    },
    dateVaryingSubtotal: Number, // 0.90 normally, 0.45 when road is degraded (§5)
    staticSubtotal: Number,
    dropped: { type: [String], default: [] },
    degraded: { type: [String], default: [] },
    lowConfidence: { type: Boolean, default: false },
    stale: { type: Boolean, default: false }, // set when served past the 24h freshness window
    computedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

pressureSchema.index({ destId: 1, date: 1 }, { unique: true });

const DestinationPressure = mongoose.model("DestinationPressure", pressureSchema);

export default DestinationPressure;
