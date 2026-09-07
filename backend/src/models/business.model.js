import mongoose from "mongoose";
import { ONBOARDING_STATES } from "../services/onboarding/stateMachine.js";

const businessSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
  },
  destId: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ["homestay", "guesthouse", "guide", "driver", "cook"],
    required: true,
  },
  ownerPhone: {
    type: String,
    required: true,
    unique: true,
    select: false,
  },
  languages: {
    type: [String],
    default: [],
  },
  capacity: {
    type: Number,
  },
  priceRangeINR: {
    min: { type: Number },
    max: { type: Number },
  },
  amenities: {
    type: [String],
    default: [],
  },
  meals: {
    type: [String],
    default: [],
  },
  nearestLandmark: {
    type: String,
  },
  photos: {
    type: [String],
    default: [],
  },
  staff_skills: {
    type: [String],
    default: [],
  },
  staff_serviceAreaDestIds: {
    type: [String],
    default: [],
  },
  onboardedVia: {
    type: String,
  },
  onboardingState: {
    type: String,
    enum: ONBOARDING_STATES,
  },
  lastWhatsAppMessageId: {
    type: String,
  },
  rawTranscript: {
    type: String,
  },
  transcriptLang: {
    type: String,
  },
  verificationTier: {
    type: String,
    enum: ["self-declared", "visit-verified", "registered"],
  },
  registrationNumber: {
    type: String,
  },
  registrationStatus: {
    type: String,
  },
  visitCount: {
    type: Number,
  },
  povSecret: {
    type: String,
    select: false,
  },
});

const Business = mongoose.model("Business", businessSchema);

export default Business;
