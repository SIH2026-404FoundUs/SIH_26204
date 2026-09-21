import mongoose from "mongoose";
import { TRAVEL_TYPE_IDS } from "../lib/travelTypes.js";

// Travel Education (Revised Implementation Plan §8/§9) -- structured
// destination knowledge keyed on the SAME canonical destId every other
// feature uses (§3: "no new namespace"). One document per destination.
//
// pressureContextTemplate is plain-English framing text ONLY (e.g. "This
// is a high-altitude route -- crowding tends to build around long
// weekends"), never a cached score -- the live number always comes from
// services/pressure/service.js at read time, per §4's read-only rule.
const sourceSchema = new mongoose.Schema(
  { label: { type: String, required: true }, url: { type: String } },
  { _id: false }
);

const feedbackSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    helpful: { type: Boolean },
    comment: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

export const EDUCATION_STATUSES = ["draft", "in_review", "published"];

const travelEducationSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // == destId
    destId: { type: String, required: true, unique: true, index: true },

    overview: { type: String },
    bestTime: { type: String },
    gettingThere: { type: String },
    gettingAround: { type: String },
    localCulture: { type: String },
    etiquette: { type: String },
    responsibleTravel: { type: String },
    safety: { type: String },
    packing: { type: String },
    food: { type: String },
    accessibility: { type: String },
    // Indicative only, never a live price feed -- §8's own "no fake live
    // pricing" rule. The destination seed's baseline_hotelMedianINR (see
    // destinations.route.js) is the honest live-ish number; this field is
    // qualitative framing ("budget to mid-range stays are common here").
    budgetContext: { type: String },
    pressureContextTemplate: { type: String },

    travelStyleTags: { type: [String], enum: TRAVEL_TYPE_IDS, default: [] },
    sources: { type: [sourceSchema], default: [] },
    feedback: { type: [feedbackSchema], default: [] },

    lastReviewedAt: { type: Date },
    version: { type: Number, default: 1 },
    // draft -> in_review -> published. Only "published" is ever served to
    // a traveller (getEducationForTraveller below) -- draft/in_review stay
    // visible to authority-side review tooling only. Never invented
    // content shipped as if it were reviewed.
    status: { type: String, enum: EDUCATION_STATUSES, default: "draft" },
  },
  { timestamps: true }
);

const TravelEducation = mongoose.model("TravelEducation", travelEducationSchema);
export default TravelEducation;
