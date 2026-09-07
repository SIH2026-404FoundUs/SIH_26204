import mongoose from "mongoose";

// alerts — every row must carry attribution (spec §3.3: "An advisory without
// attribution is indistinguishable from a hallucination"). Enforced here at the
// schema level (required), not only as an app-level check in alertService.js.
const alertSchema = new mongoose.Schema(
  {
    destId: { type: String, required: true }, // Ananya's canonical slug
    kind: {
      type: String,
      enum: ["weather", "road", "policy", "restriction", "hazard"],
      required: true,
    },
    severity: { type: String, enum: ["info", "warning", "critical"], default: "info" },
    body: { type: String, required: true },
    sourceUrl: { type: String, required: true },
    sourceName: { type: String, required: true },
    validFrom: { type: Date, required: true },
    validTo: { type: Date, required: true },
    fetchedAt: { type: Date, default: Date.now },
    hash: { type: String, required: true, unique: true }, // sha256(destId+kind+normalisedBody), idempotent upsert key
  },
  { timestamps: true }
);

alertSchema.index({ destId: 1, validTo: 1 });

const Alert = mongoose.model("Alert", alertSchema, "alerts");
export default Alert;
