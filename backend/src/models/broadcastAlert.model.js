import mongoose from "mongoose";

// A platform-wide emergency broadcast an authority sends directly (disaster,
// safety incident, anything that needs every account reached now) --
// deliberately a separate collection from alert.model.js, not a destId="*"
// hack bolted onto it. That model's sourceUrl/sourceName are mandatory
// because every row there is a citation of an external feed (weather/road/
// policy); a broadcast has no external source to cite, it IS the authority
// speaking directly, so forcing it through that schema would mean inventing
// a fake source just to satisfy a validator that exists specifically to
// prevent fabricated attribution.
const broadcastAlertSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 140 },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    // Same three-value taxonomy as alert.model.js's severity, so the
    // frontend's existing alertSeverity() label/tone mapping (lib/labels.js)
    // applies here unchanged -- no second severity vocabulary to keep in sync.
    severity: { type: String, enum: ["info", "warning", "critical"], default: "critical" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    createdByName: { type: String, required: true },
    recipientCount: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

broadcastAlertSchema.index({ active: 1, createdAt: -1 });

const BroadcastAlert = mongoose.model("BroadcastAlert", broadcastAlertSchema, "broadcast_alerts");
export default BroadcastAlert;
