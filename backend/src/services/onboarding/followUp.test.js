import { describe, test, expect } from "@jest/globals";
import { REQUIRED_FIELDS_FOR_LIVE } from "./stateMachine.js";
import { getNextFollowUpQuestion } from "./followUp.js";

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

  test("does not mutate the input currentFields object", () => {
    const fields = { ...completeFields, name: null };
    const snapshot = JSON.parse(JSON.stringify(fields));

    getNextFollowUpQuestion(fields, "en");

    expect(fields).toEqual(snapshot);
  });
});
