import { describe, test, expect } from "@jest/globals";
import { REQUIRED_FIELDS_FOR_LIVE } from "./stateMachine.js";
import { getNextFollowUpQuestion, getNextMissingRequiredField, getPhotosFollowUpQuestion } from "./followUp.js";

const completeFields = {
  name: "Green Valley Homestay",
  type: "homestay",
  capacity: 4,
  priceRangeINR: { min: 1000, max: 2000 },
  nearestLandmark: "Main Chowk",
  destId: "shimla",
};

describe("getNextFollowUpQuestion", () => {
  test("returns null when every required field is already non-null", () => {
    expect(getNextFollowUpQuestion(completeFields, "en")).toBeNull();
  });

  test("an empty currentFields object (nothing known yet) asks a question, not null", () => {
    // Sanity check on the fixture itself: REQUIRED_FIELDS_FOR_LIVE must be
    // non-empty for the "returns null when nothing missing" test above to
    // mean anything.
    expect(REQUIRED_FIELDS_FOR_LIVE.length).toBeGreaterThan(0);
    expect(getNextFollowUpQuestion({}, "en")).not.toBeNull();
  });

  describe("asks about each required field individually when it's the only one missing", () => {
    for (const field of REQUIRED_FIELDS_FOR_LIVE) {
      test(`${field} missing produces a non-empty, field-specific question`, () => {
        const fields = { ...completeFields, [field]: null };
        const question = getNextFollowUpQuestion(fields, "en");

        expect(typeof question).toBe("string");
        expect(question.length).toBeGreaterThan(0);
      });
    }
  });

  test("a missing key entirely (not just null) is treated the same as null", () => {
    const { name, ...withoutName } = completeFields;
    const withNull = { ...completeFields, name: null };

    expect(getNextFollowUpQuestion(withoutName, "en")).toBe(getNextFollowUpQuestion(withNull, "en"));
  });

  test("when multiple fields are missing, asks about the first one in REQUIRED_FIELDS_FOR_LIVE's own order", () => {
    // capacity and destId are both missing here; REQUIRED_FIELDS_FOR_LIVE
    // orders capacity before destId, so capacity's question must come back.
    const fields = { ...completeFields, capacity: null, destId: null };

    expect(getNextFollowUpQuestion(fields, "en")).toBe(getNextFollowUpQuestion({ ...completeFields, capacity: null }, "en"));
  });

  test("asking order matches REQUIRED_FIELDS_FOR_LIVE exactly, one field revealed at a time", () => {
    // Start with nothing, then fill in fields one by one in
    // REQUIRED_FIELDS_FOR_LIVE's own order, confirming the question asked
    // always corresponds to the next still-missing field in that order.
    let fields = {};
    for (let i = 0; i < REQUIRED_FIELDS_FOR_LIVE.length; i++) {
      const expectedNextField = REQUIRED_FIELDS_FOR_LIVE[i];
      const questionForExpectedField = getNextFollowUpQuestion(
        { ...completeFields, [expectedNextField]: null },
        "en"
      );

      expect(getNextFollowUpQuestion(fields, "en")).toBe(questionForExpectedField);

      fields = { ...fields, [expectedNextField]: completeFields[expectedNextField] };
    }
    expect(getNextFollowUpQuestion(fields, "en")).toBeNull();
  });

  describe("destId's question is honestly about location, not a generic field name", () => {
    test("mentions town/area, not the word 'destId'", () => {
      const question = getNextFollowUpQuestion({ ...completeFields, destId: null }, "en");

      expect(question.toLowerCase()).not.toContain("destid");
      expect(question.toLowerCase()).toMatch(/town|area/);
    });

    test("is a genuinely different question from every other field's question", () => {
      const destIdQuestion = getNextFollowUpQuestion({ ...completeFields, destId: null }, "en");

      for (const field of REQUIRED_FIELDS_FOR_LIVE) {
        if (field === "destId") continue;
        const otherQuestion = getNextFollowUpQuestion({ ...completeFields, [field]: null }, "en");
        expect(otherQuestion).not.toBe(destIdQuestion);
      }
    });
  });

  describe("language handling", () => {
    test("returns Hindi text when language is 'hi' and a translation exists", () => {
      const question = getNextFollowUpQuestion({ ...completeFields, name: null }, "hi");

      // Devanagari script range, not just "not English" -- a real
      // translation, not a coincidentally-different string.
      expect(question).toMatch(/[ऀ-ॿ]/);
    });

    test("falls back to English for an unrecognized/untranslated language code", () => {
      const englishQuestion = getNextFollowUpQuestion({ ...completeFields, name: null }, "en");
      const fallbackQuestion = getNextFollowUpQuestion({ ...completeFields, name: null }, "fr");

      expect(fallbackQuestion).toBe(englishQuestion);
    });

    test("falls back to English when language is omitted entirely", () => {
      const englishQuestion = getNextFollowUpQuestion({ ...completeFields, name: null }, "en");
      const omittedQuestion = getNextFollowUpQuestion({ ...completeFields, name: null });

      expect(omittedQuestion).toBe(englishQuestion);
    });
  });

  describe("priceRangeINR — Mongoose {} default regression", () => {
    // Confirmed while tracing the real FOLLOWUP loop: Mongoose
    // auto-instantiates priceRangeINR as `{}` on document creation, even
    // when never explicitly set. `{}` is neither null nor undefined, so
    // without the fix this silently skipped priceRangeINR's question
    // entirely, jumping straight to nearestLandmark.
    test("priceRangeINR: {} is correctly detected as missing, not skipped", () => {
      const fields = { ...completeFields, priceRangeINR: {} };
      const question = getNextFollowUpQuestion(fields, "en");

      expect(question).toBe("What is your price range per night, in rupees?");
    });

    test("priceRangeINR with only min set is still detected as missing", () => {
      const fields = { ...completeFields, priceRangeINR: { min: 1000 } };
      expect(getNextFollowUpQuestion(fields, "en")).toBe("What is your price range per night, in rupees?");
    });

    test("priceRangeINR with both min and max set is correctly treated as answered", () => {
      const fields = { ...completeFields, priceRangeINR: { min: 1000, max: 2000 } };
      // nearestLandmark is next in order and is already set in
      // completeFields, so this should return null (nothing missing).
      expect(getNextFollowUpQuestion(fields, "en")).toBeNull();
    });
  });

  test("does not mutate the input currentFields object", () => {
    const fields = { ...completeFields, name: null };
    const snapshot = JSON.parse(JSON.stringify(fields));

    getNextFollowUpQuestion(fields, "en");

    expect(fields).toEqual(snapshot);
  });
});

describe("getNextMissingRequiredField", () => {
  test("returns the field NAME, not question text, for the first missing field", () => {
    const fields = { ...completeFields, capacity: null };
    expect(getNextMissingRequiredField(fields)).toBe("capacity");
  });

  test("returns null when every required field is already genuinely present", () => {
    expect(getNextMissingRequiredField(completeFields)).toBeNull();
  });

  test("matches whatever field getNextFollowUpQuestion is basing its question on, for every single-missing-field case", () => {
    for (const field of REQUIRED_FIELDS_FOR_LIVE) {
      const fields = { ...completeFields, [field]: null };
      expect(getNextMissingRequiredField(fields)).toBe(field);
    }
  });

  test("an empty object returns the first field in REQUIRED_FIELDS_FOR_LIVE order", () => {
    expect(getNextMissingRequiredField({})).toBe(REQUIRED_FIELDS_FOR_LIVE[0]);
  });

  test("handles the priceRangeINR Mongoose {} default the same way hasRequiredFieldsForLive does", () => {
    const fields = { ...completeFields, priceRangeINR: {} };
    expect(getNextMissingRequiredField(fields)).toBe("priceRangeINR");
  });
});

describe("getPhotosFollowUpQuestion", () => {
  test("returns English photo prompt by default or for 'en'", () => {
    expect(getPhotosFollowUpQuestion("en")).toContain("photos");
    expect(getPhotosFollowUpQuestion()).toContain("photos");
  });

  test("returns Hindi photo prompt for 'hi'", () => {
    const question = getPhotosFollowUpQuestion("hi");
    expect(question).toMatch(/[ऀ-ॿ]/);
  });
});
