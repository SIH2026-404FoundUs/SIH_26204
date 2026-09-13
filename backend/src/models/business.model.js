import mongoose from "mongoose";
import { ONBOARDING_STATES } from "../services/onboarding/stateMachine.js";

const LIVE_STATE = ONBOARDING_STATES[ONBOARDING_STATES.length - 1];

// name/type/destId are only guaranteed known once a business reaches its
// final onboarding state (LIVE) — the whole point of EXTRACTING/FOLLOWUP/
// etc is that these can still be null while a draft is mid-onboarding
// (stateMachine.js's own hasRequiredFieldsForLive() already gates the
// LIVE transition itself on exactly these fields, destId included — see
// its own comment for why destId was added there beyond Section 1.3's
// literal five-field list). A document with no onboardingState at all
// (seeded/regular businesses never going through this pipeline) still
// requires them unconditionally — this preserves this schema's original
// behavior for anything outside the onboarding flow, and is what keeps
// business.model.test.js's existing "rejects when name/type is missing"
// tests passing unchanged.
//
// destId specifically: a brand-new WhatsApp-originated draft has no way
// to supply one on its very first message (Meta's payload carries no
// location data, and there is still no destId RESOLUTION step — turning
// transcript text like "near the mall in Shimla" into the canonical slug
// "shimla" — built anywhere; extractFields() returning real field values
// doesn't solve this, it's separate, unbuilt work). Blocking draft
// creation entirely until that's built would mean the real WhatsApp path
// can never onboard a genuinely new business at all, so destId is allowed
// to start null and be filled in later, exactly like name/type.
//
// Handles both contexts a `required` function can run in: document-save
// (`this` is the Document itself) and update-validator with
// { context: "query" } (`this` is the Query; the value being written
// lives in this.getUpdate().$set — Mongoose does not merge update
// validation against the existing document).
function requiredUnlessMidOnboarding() {
  const onboardingState =
    typeof this.getUpdate === "function" ? this.getUpdate()?.$set?.onboardingState : this.onboardingState;
  return onboardingState == null || onboardingState === LIVE_STATE;
}

const businessSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
  },
  destId: {
    type: String,
    required: requiredUnlessMidOnboarding,
  },
  name: {
    type: String,
    required: requiredUnlessMidOnboarding,
  },
  type: {
    type: String,
    // hotel/restaurant added for the operator "Register Business" web form
    // (POST /v1/businesses) alongside the original WhatsApp-onboarding set --
    // same field, same enum, just a wider vocabulary now that a business can
    // register itself directly instead of only ever arriving via the audio
    // pipeline.
    enum: ["homestay", "guesthouse", "hotel", "restaurant", "guide", "driver", "cook"],
    required: requiredUnlessMidOnboarding,
  },
  ownerPhone: {
    type: String,
    required: true,
    unique: true,
    select: false,
  },
  ownerUserId: {
    type: String,
    index: true,
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
  // AI Tourist Feedback Intelligence (spec §3.2) cache -- written by
  // processBusinessFeedback() once a business has >= MIN_FEEDBACK_THRESHOLD
  // reviews. Cached here (rather than recomputed on every read) so
  // GET .../insights can serve the last processed summary instantly;
  // getBusinessFeedbackInsights() only recomputes on the fly if these are
  // still empty.
  aiThemes: {
    type: [mongoose.Schema.Types.Mixed],
    default: [],
  },
  aiActions: {
    type: [mongoose.Schema.Types.Mixed],
    default: [],
  },
  feedbackSummary: {
    totalReviews: { type: Number },
    averageRating: { type: Number },
    lastProcessedAt: { type: Date },
  },
  // bharani-tasks.md Section 1.5 (registration assist) — collected for the
  // state homestay registration application, not for going LIVE/discoverable
  // (Section 1's own framing keeps those explicitly separate concerns), so
  // none of these four are in REQUIRED_FIELDS_FOR_LIVE / hasRequiredFieldsForLive().
  ownerName: {
    type: String,
  },
  propertyAddress: {
    village: { type: String },
    street: { type: String },
    district: { type: String },
    pincode: { type: String },
  },
  roomsLet: {
    type: Number,
  },
  ownerResidesOnPremises: {
    type: Boolean,
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
  // createdAt/updatedAt, added by Mongoose's own `timestamps` option
  // below, not a manual field on this schema. Checked before adding: no
  // manual createdAt/updatedAt exists anywhere in this schema, so nothing
  // to collide with. businessAvailability.model.js and
  // destinationDemand.model.js do define their own manual `updatedAt`
  // (default: Date.now), but those are separate schemas/collections
  // entirely, unaffected by this change.
  },
  { timestamps: true }
);

const Business = mongoose.model("Business", businessSchema);

export default Business;
