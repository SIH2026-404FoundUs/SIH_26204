import { describe, test, expect } from "@jest/globals";
import {
  ONBOARDING_STATES,
  REQUIRED_FIELDS_FOR_LIVE,
  isValidTransition,
  hasRequiredFieldsForLive,
  transitionDraft,
} from "./stateMachine.js";

const completeFields = {
  name: "Green Valley Homestay",
  type: "homestay",
  capacity: 4,
  priceRangeINR: { min: 1000, max: 2000 },
  nearestLandmark: "Main Chowk",
};

describe("ONBOARDING_STATES", () => {
  test("is the exact nine-state sequence from bharani-tasks.md Section 1.1", () => {
    expect(ONBOARDING_STATES).toEqual([
      "AWAITING_CONSENT",
      "AWAITING_VOICE",
      "TRANSCRIBING",
      "EXTRACTING",
      "AWAITING_PHOTOS",
      "FOLLOWUP",
      "AWAITING_DATES",
      "DRAFT_CONFIRM",
      "LIVE",
    ]);
  });
});

describe("isValidTransition", () => {
  test("accepts every consecutive step of the documented sequence", () => {
    for (let i = 0; i < ONBOARDING_STATES.length - 1; i++) {
      expect(isValidTransition(ONBOARDING_STATES[i], ONBOARDING_STATES[i + 1])).toBe(true);
    }
  });

  test("a brand-new draft (null/undefined state) may only enter AWAITING_CONSENT", () => {
    expect(isValidTransition(null, "AWAITING_CONSENT")).toBe(true);
    expect(isValidTransition(undefined, "AWAITING_CONSENT")).toBe(true);
    expect(isValidTransition(null, "AWAITING_VOICE")).toBe(false);
    expect(isValidTransition(null, "LIVE")).toBe(false);
  });

  test("rejects skipping straight from AWAITING_CONSENT to LIVE", () => {
    expect(isValidTransition("AWAITING_CONSENT", "LIVE")).toBe(false);
  });

  test("rejects skipping any single intermediate state", () => {
    // AWAITING_VOICE -> EXTRACTING skips TRANSCRIBING.
    expect(isValidTransition("AWAITING_VOICE", "EXTRACTING")).toBe(false);
    // EXTRACTING -> FOLLOWUP skips AWAITING_PHOTOS.
    expect(isValidTransition("EXTRACTING", "FOLLOWUP")).toBe(false);
    // AWAITING_DATES -> LIVE skips DRAFT_CONFIRM.
    expect(isValidTransition("AWAITING_DATES", "LIVE")).toBe(false);
  });

  test("rejects moving backwards", () => {
    expect(isValidTransition("EXTRACTING", "TRANSCRIBING")).toBe(false);
    expect(isValidTransition("LIVE", "DRAFT_CONFIRM")).toBe(false);
  });

  test("FOLLOWUP may loop on itself", () => {
    expect(isValidTransition("FOLLOWUP", "FOLLOWUP")).toBe(true);
  });

  test("no other state may loop on itself", () => {
    for (const state of ONBOARDING_STATES) {
      if (state === "FOLLOWUP") continue;
      expect(isValidTransition(state, state)).toBe(false);
    }
  });

  test("LIVE is terminal — nothing is a valid next state from it, including LIVE itself", () => {
    for (const state of ONBOARDING_STATES) {
      expect(isValidTransition("LIVE", state)).toBe(false);
    }
  });

  test("rejects an unknown state name entirely", () => {
    expect(isValidTransition("AWAITING_CONSENT", "NOT_A_REAL_STATE")).toBe(false);
    expect(isValidTransition("NOT_A_REAL_STATE", "AWAITING_VOICE")).toBe(false);
  });
});

describe("hasRequiredFieldsForLive", () => {
  test("true when all five required fields are non-null", () => {
    expect(hasRequiredFieldsForLive(completeFields)).toBe(true);
  });

  test("false when any one required field is missing", () => {
    for (const key of REQUIRED_FIELDS_FOR_LIVE) {
      const incomplete = { ...completeFields, [key]: null };
      expect(hasRequiredFieldsForLive(incomplete)).toBe(false);
    }
  });

  test("false when a required field key is absent entirely (not just null)", () => {
    const { name, ...withoutName } = completeFields;
    expect(hasRequiredFieldsForLive(withoutName)).toBe(false);
  });

  test("false on an empty object", () => {
    expect(hasRequiredFieldsForLive({})).toBe(false);
  });

  test("extra non-required fields being null doesn't affect the result", () => {
    expect(hasRequiredFieldsForLive({ ...completeFields, amenities: null, meals: null })).toBe(true);
  });
});

describe("transitionDraft", () => {
  test("walks a draft through the full sequence to LIVE", () => {
    let draft = { onboardingState: null, lastWhatsAppMessageId: null };
    let msgCounter = 0;

    for (const nextState of ONBOARDING_STATES) {
      msgCounter += 1;
      const messageId = `wamid.${msgCounter}`;
      const fieldsForThisStep = nextState === "LIVE" || nextState === "DRAFT_CONFIRM" ? completeFields : {};

      const result = transitionDraft({ ...draft, ...fieldsForThisStep }, nextState, messageId);

      expect(result.applied).toBe(true);
      expect(result.state).toBe(nextState);
      draft = { onboardingState: result.state, lastWhatsAppMessageId: result.lastWhatsAppMessageId };
    }

    expect(draft.onboardingState).toBe("LIVE");
  });

  test("rejects jumping from AWAITING_CONSENT straight to LIVE", () => {
    const draft = { onboardingState: "AWAITING_CONSENT", lastWhatsAppMessageId: "wamid.1" };
    const result = transitionDraft(draft, "LIVE", "wamid.2");

    expect(result.applied).toBe(false);
    expect(result.reason).toBe("invalid_transition");
    expect(result.state).toBe("AWAITING_CONSENT");
  });

  test("idempotency: replaying the same lastWhatsAppMessageId does not advance state a second time", () => {
    const messageId = "wamid.replayed-by-meta";
    const draft = { onboardingState: "AWAITING_CONSENT", lastWhatsAppMessageId: "wamid.0" };

    const first = transitionDraft(draft, "AWAITING_VOICE", messageId);
    expect(first.applied).toBe(true);
    expect(first.state).toBe("AWAITING_VOICE");

    const advancedDraft = { onboardingState: first.state, lastWhatsAppMessageId: first.lastWhatsAppMessageId };

    // Meta retries the identical webhook: same messageId, delivered again.
    const replay = transitionDraft(advancedDraft, "TRANSCRIBING", messageId);

    expect(replay.applied).toBe(false);
    expect(replay.reason).toBe("duplicate_message");
    // State must NOT have advanced to TRANSCRIBING on the replay.
    expect(replay.state).toBe("AWAITING_VOICE");
  });

  test("a genuinely new message id after a duplicate is processed normally", () => {
    const draft = { onboardingState: "AWAITING_VOICE", lastWhatsAppMessageId: "wamid.1" };

    const replay = transitionDraft(draft, "TRANSCRIBING", "wamid.1");
    expect(replay.applied).toBe(false);

    const genuine = transitionDraft(draft, "TRANSCRIBING", "wamid.2");
    expect(genuine.applied).toBe(true);
    expect(genuine.state).toBe("TRANSCRIBING");
    expect(genuine.lastWhatsAppMessageId).toBe("wamid.2");
  });

  test("FOLLOWUP can loop on itself across multiple messages without a fixed iteration cap", () => {
    let draft = { onboardingState: "FOLLOWUP", lastWhatsAppMessageId: "wamid.5" };

    for (let i = 6; i <= 20; i++) {
      const result = transitionDraft(draft, "FOLLOWUP", `wamid.${i}`);
      expect(result.applied).toBe(true);
      expect(result.state).toBe("FOLLOWUP");
      draft = { onboardingState: result.state, lastWhatsAppMessageId: result.lastWhatsAppMessageId };
    }
  });

  test("FOLLOWUP advances to AWAITING_DATES once the caller decides fields are complete", () => {
    const draft = { onboardingState: "FOLLOWUP", lastWhatsAppMessageId: "wamid.9", ...completeFields };
    const result = transitionDraft(draft, "AWAITING_DATES", "wamid.10");

    expect(result.applied).toBe(true);
    expect(result.state).toBe("AWAITING_DATES");
  });

  test("rejects DRAFT_CONFIRM -> LIVE when required fields are missing", () => {
    const incomplete = { name: "Test Homestay", type: "homestay" }; // capacity, priceRangeINR, nearestLandmark all missing
    const draft = { onboardingState: "DRAFT_CONFIRM", lastWhatsAppMessageId: "wamid.1", ...incomplete };

    const result = transitionDraft(draft, "LIVE", "wamid.2");

    expect(result.applied).toBe(false);
    expect(result.reason).toBe("missing_required_fields");
    expect(result.state).toBe("DRAFT_CONFIRM");
  });

  test("accepts DRAFT_CONFIRM -> LIVE when all five required fields are non-null", () => {
    const draft = { onboardingState: "DRAFT_CONFIRM", lastWhatsAppMessageId: "wamid.1", ...completeFields };

    const result = transitionDraft(draft, "LIVE", "wamid.2");

    expect(result.applied).toBe(true);
    expect(result.state).toBe("LIVE");
  });

  test("does not mutate the input draft object", () => {
    const draft = { onboardingState: "AWAITING_CONSENT", lastWhatsAppMessageId: "wamid.1" };
    const snapshot = JSON.parse(JSON.stringify(draft));

    transitionDraft(draft, "AWAITING_VOICE", "wamid.2");

    expect(draft).toEqual(snapshot);
  });
});
