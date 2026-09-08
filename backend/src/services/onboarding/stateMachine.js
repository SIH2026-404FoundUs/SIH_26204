// Voice Onboarding — bharani-tasks.md Section 1.1 conversation state machine.
//
// AWAITING_CONSENT -> AWAITING_VOICE -> TRANSCRIBING -> EXTRACTING ->
// AWAITING_PHOTOS -> FOLLOWUP -> AWAITING_DATES -> DRAFT_CONFIRM -> LIVE
//
// Pure logic only: no WhatsApp API calls, no transcription, no AI calls.
// This module just decides whether a proposed state transition is allowed,
// and enforces the two hard gates the spec calls out by name:
//   - idempotency, keyed by lastWhatsAppMessageId (Meta retries webhooks;
//     a replayed message must not advance state twice)
//   - the "Required for LIVE" fields must all be non-null before
//     DRAFT_CONFIRM -> LIVE is allowed (Section 1.3 names five: name,
//     type, capacity, priceRangeINR, nearestLandmark; destId is added as
//     a sixth here — not in the spec's literal list, but destId's schema
//     requirement is now conditional the same way name/type's is
//     (business.model.js's requiredUnlessMidOnboarding), so this gate and
//     the schema's own requiredness must agree on what LIVE actually
//     requires, or a transition the state machine calls "applied" could
//     still fail at the database layer with a raw ValidationError)

export const ONBOARDING_STATES = [
  "AWAITING_CONSENT",
  "AWAITING_VOICE",
  "TRANSCRIBING",
  "EXTRACTING",
  "AWAITING_PHOTOS",
  "FOLLOWUP",
  "AWAITING_DATES",
  "DRAFT_CONFIRM",
  "LIVE",
];

// Section 1.3 — "Required for LIVE: name, type, capacity, priceRangeINR, nearestLandmark."
// destId is appended beyond the spec's literal list — see module docstring.
export const REQUIRED_FIELDS_FOR_LIVE = ["name", "type", "capacity", "priceRangeINR", "nearestLandmark", "destId"];

const INITIAL_STATE = ONBOARDING_STATES[0];

// Adjacency map built off the linear sequence above, plus the one documented
// exception: FOLLOWUP loops on itself until all required fields are non-null
// (Section 1.1: "loop until required fields are non-null"), so it is modeled
// as a valid self-transition rather than a fixed number of iterations.
const NEXT_STATES = new Map();
for (let i = 0; i < ONBOARDING_STATES.length - 1; i++) {
  NEXT_STATES.set(ONBOARDING_STATES[i], [ONBOARDING_STATES[i + 1]]);
}
NEXT_STATES.get("FOLLOWUP").push("FOLLOWUP");
NEXT_STATES.set("LIVE", []); // terminal state, nothing follows it

/**
 * Whether `toState` is a legal next state from `fromState`.
 *
 * `fromState` of null/undefined represents a brand-new draft with no state
 * yet, whose only legal first state is AWAITING_CONSENT (the state a draft
 * enters on the very first inbound message). Every other transition must
 * follow the exact documented sequence, plus the FOLLOWUP self-loop —
 * skipping states (e.g. AWAITING_CONSENT straight to LIVE) is rejected.
 *
 * @param {string|null|undefined} fromState
 * @param {string} toState
 * @returns {boolean}
 */
export function isValidTransition(fromState, toState) {
  if (fromState === null || fromState === undefined) {
    return toState === INITIAL_STATE;
  }
  const allowed = NEXT_STATES.get(fromState);
  return Array.isArray(allowed) && allowed.includes(toState);
}

/**
 * Whether every field in REQUIRED_FIELDS_FOR_LIVE is non-null on `fields`.
 * Missing keys count as null (undefined !== present-and-non-null).
 *
 * @param {Object} fields
 * @returns {boolean}
 */
export function hasRequiredFieldsForLive(fields = {}) {
  return REQUIRED_FIELDS_FOR_LIVE.every((key) => fields[key] !== null && fields[key] !== undefined);
}

/**
 * Attempts to move a business draft to `toState`. Pure function — never
 * mutates `draft`; the caller persists the returned state back to the
 * document itself.
 *
 * Idempotency: if `incomingMessageId` matches `draft.lastWhatsAppMessageId`,
 * this is a replayed webhook (Meta retries) and the attempt is a no-op —
 * the draft's current state and lastWhatsAppMessageId are returned
 * unchanged, `applied` is false, and `reason` is "duplicate_message".
 *
 * @param {Object} draft - { onboardingState, lastWhatsAppMessageId, ...extracted fields }
 * @param {string} toState - the state the caller wants to move to
 * @param {string} incomingMessageId - the WhatsApp message id driving this attempt
 * @returns {{ applied: boolean, reason: string|null, state: string|null, lastWhatsAppMessageId: string|null }}
 */
export function transitionDraft(draft, toState, incomingMessageId) {
  const currentState = draft?.onboardingState ?? null;
  const currentMessageId = draft?.lastWhatsAppMessageId ?? null;

  if (incomingMessageId != null && currentMessageId != null && incomingMessageId === currentMessageId) {
    return {
      applied: false,
      reason: "duplicate_message",
      state: currentState,
      lastWhatsAppMessageId: currentMessageId,
    };
  }

  if (!isValidTransition(currentState, toState)) {
    return {
      applied: false,
      reason: "invalid_transition",
      state: currentState,
      lastWhatsAppMessageId: currentMessageId,
    };
  }

  if (toState === "LIVE" && !hasRequiredFieldsForLive(draft ?? {})) {
    return {
      applied: false,
      reason: "missing_required_fields",
      state: currentState,
      lastWhatsAppMessageId: currentMessageId,
    };
  }

  return {
    applied: true,
    reason: null,
    state: toState,
    lastWhatsAppMessageId: incomingMessageId ?? currentMessageId,
  };
}
