import mongoose from "mongoose";

// Worker role design spec §02 -- a person, kept separate from the short-lived
// GigRequest/GigMatch documents that reference them, so a gig's lifecycle
// never has to touch this standing profile. This is the same idea
// Business.staff_skills/staff_serviceAreaDestIds were already groping toward
// (a worker modeled as a Business document owned by an operator) -- moved to
// where it actually belongs: a person, not a listing. Those two Business
// fields are left as-is (nothing here removes them) since existing
// operator flows (Hire People) still read Business documents of type
// "driver"/"guide"/"cook" -- this collection is additive, not a migration.
export const WORKER_SKILLS = ["guide", "driver", "cook", "cleaner", "porter", "other"];
export const WORKER_VERIFICATION_TIERS = ["self-declared", "visit-verified", "registered"];
export const GOVERNMENT_ID_TYPES = ["aadhaar", "pan", "voter_id", "driving_license", "passport"];

const workerProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // one profile per worker account
      index: true,
    },
    // Self-declared, same as everything else on this profile (verified only
    // if verificationTier ever moves past "self-declared") -- an operator
    // deciding whether to accept a gig offer wants to know who they're
    // actually hiring, not just a skill tag. Mandatory: gigService's own
    // validation refuses the upsert without both, and these `required`
    // flags are the same guarantee enforced again at the DB layer.
    legalName: { type: String, trim: true, required: true },
    governmentId: {
      idType: { type: String, enum: GOVERNMENT_ID_TYPES, required: true },
      idNumber: { type: String, trim: true, required: true },
    },
    skills: {
      type: [String],
      enum: WORKER_SKILLS,
      default: [],
    },
    // Mirrors Business.staff_serviceAreaDestIds -- same concept, moved to
    // the person instead of a listing they don't own.
    serviceAreaDestIds: {
      type: [String],
      default: [],
    },
    availability: {
      mode: { type: String, enum: ["now", "scheduled"], default: "scheduled" },
      windows: [
        {
          date: { type: Date, required: true },
          from: { type: String }, // "HH:mm", display-only at MVP weight
          to: { type: String },
          _id: false,
        },
      ],
    },
    rateExpectation: {
      min: { type: Number },
      max: { type: Number },
      unit: { type: String, enum: ["day", "trip", "hour"], default: "day" },
    },
    // Same three-tier ladder Business.verificationTier already uses -- same
    // concept, no new idea to design or explain (spec §07).
    verificationTier: {
      type: String,
      enum: WORKER_VERIFICATION_TIERS,
      default: "self-declared",
    },
    rating: {
      avg: { type: Number, default: 0 },
      count: { type: Number, default: 0 },
    },
    languages: {
      type: [String],
      default: [],
    },
    onboardedVia: {
      type: String,
      enum: ["app", "whatsapp"],
      default: "app",
    },
  },
  { timestamps: true }
);

const WorkerProfile = mongoose.model("WorkerProfile", workerProfileSchema);
export default WorkerProfile;
