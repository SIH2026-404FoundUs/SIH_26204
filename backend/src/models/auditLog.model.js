import mongoose from "mongoose";

// audit_logs — every accept and reject across the trust vertical (PoV, offers,
// community, alerts) writes here with a reasonCode, so any disputed case can be
// explained after the fact (spec §1.3).
const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: String, required: true },
    action: { type: String, required: true },
    target: { type: String },
    reasonCode: { type: String, required: true },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    at: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

auditLogSchema.index({ actor: 1, at: -1 });
auditLogSchema.index({ action: 1, at: -1 });

const AuditLog = mongoose.model("AuditLog", auditLogSchema, "audit_logs");
export default AuditLog;
