import { describe, test, expect } from "@jest/globals";
import { validateExtractionShape, checkExtractionHonesty, EXTRACTION_TYPE_VALUES } from "./extraction.js";

const fullValidExtraction = () => ({
  name: "Green Valley Homestay",
  type: "homestay",
  capacity: 4,
  priceRangeINR: { min: 1000, max: 2000 },
  amenities: ["hot water", "parking"],
  meals: ["breakfast"],
  nearestLandmark: "Main Chowk",
  languages: ["hi", "en"],
  seasonalNotes: "closed in monsoon",
});

const allNullExtraction = () => ({
  name: null,
  type: null,
  capacity: null,
  priceRangeINR: null,
  amenities: [],
  meals: [],
  nearestLandmark: null,
  languages: [],
  seasonalNotes: null,
});

describe("validateExtractionShape", () => {
  test("accepts a fully populated valid extraction", () => {
    const result = validateExtractionShape(fullValidExtraction());
    expect(result).toEqual({ valid: true, errors: [] });
  });

  test("accepts the minimal all-null/empty-array shape", () => {
    const result = validateExtractionShape(allNullExtraction());
    expect(result).toEqual({ valid: true, errors: [] });
  });

  test("accepts every value in the type enum", () => {
    for (const type of EXTRACTION_TYPE_VALUES) {
      const result = validateExtractionShape({ ...allNullExtraction(), type });
      expect(result.valid).toBe(true);
    }
  });

  test.each([null, undefined, "not an object", 42, ["array", "not", "object"]])(
    "rejects non-object input: %p",
    (input) => {
      const result = validateExtractionShape(input);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    }
  );

  test("rejects when a required field is missing entirely", () => {
    const { name, ...withoutName } = fullValidExtraction();
    const result = validateExtractionShape(withoutName);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('missing field: "name"');
  });

  test("rejects an unexpected extra field rather than ignoring it", () => {
    const result = validateExtractionShape({ ...allNullExtraction(), extraField: "surprise" });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('unexpected field: "extraField"');
  });

  test("rejects an invalid type enum value instead of coercing it", () => {
    const result = validateExtractionShape({ ...allNullExtraction(), type: "hotel" });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('invalid field: "type"');
  });

  test("rejects a non-integer capacity instead of coercing it", () => {
    const asFloat = validateExtractionShape({ ...allNullExtraction(), capacity: 3.5 });
    expect(asFloat.valid).toBe(false);
    expect(asFloat.errors).toContain('invalid field: "capacity"');

    const asString = validateExtractionShape({ ...allNullExtraction(), capacity: "3" });
    expect(asString.valid).toBe(false);
    expect(asString.errors).toContain('invalid field: "capacity"');
  });

  test("rejects priceRangeINR with non-integer min/max", () => {
    const result = validateExtractionShape({
      ...allNullExtraction(),
      priceRangeINR: { min: 1000.5, max: 2000 },
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('invalid field: "priceRangeINR"');
  });

  test("rejects priceRangeINR with an extra nested key", () => {
    const result = validateExtractionShape({
      ...allNullExtraction(),
      priceRangeINR: { min: 1000, max: 2000, currency: "INR" },
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('invalid field: "priceRangeINR"');
  });

  test("rejects amenities containing a non-string element", () => {
    const result = validateExtractionShape({ ...allNullExtraction(), amenities: ["wifi", 5] });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('invalid field: "amenities"');
  });

  test("rejects amenities/meals/languages that are null instead of an array", () => {
    const result = validateExtractionShape({ ...allNullExtraction(), amenities: null });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('invalid field: "amenities"');
  });

  test("reports every violation at once, not just the first", () => {
    const result = validateExtractionShape({
      ...allNullExtraction(),
      type: "hotel",
      capacity: "four",
      surprise: true,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('invalid field: "type"');
    expect(result.errors).toContain('invalid field: "capacity"');
    expect(result.errors).toContain('unexpected field: "surprise"');
  });
});

describe("checkExtractionHonesty", () => {
  test("passes when every claimed field genuinely appears in the transcript", () => {
    const transcript =
      "My place is called Green Valley Homestay, near Main Chowk. We offer hot water and parking, and breakfast. We are closed in monsoon.";
    const extraction = fullValidExtraction();

    const result = checkExtractionHonesty(extraction, transcript);

    expect(result).toEqual({ honest: true, failedFields: [] });
  });

  // Definition of Done: "The post-check catches an invented amenity in a
  // manual test — verify this actually fires, do not just assume the
  // prompt prevents it."
  test("catches an invented amenity the transcript never mentions", () => {
    const transcript = "My place is called Green Valley Homestay, near Main Chowk. We offer breakfast.";
    const extraction = {
      ...fullValidExtraction(),
      amenities: ["hot water", "swimming pool"], // "swimming pool" was never said
    };

    const result = checkExtractionHonesty(extraction, transcript);

    expect(result.honest).toBe(false);
    expect(result.failedFields).toContainEqual({ field: "amenities[1]", value: "swimming pool" });
  });

  test("catches an invented name not present in the transcript", () => {
    const transcript = "We are near Main Chowk and offer breakfast.";
    const extraction = { ...fullValidExtraction(), amenities: [], meals: [] };

    const result = checkExtractionHonesty(extraction, transcript);

    expect(result.honest).toBe(false);
    expect(result.failedFields).toContainEqual({ field: "name", value: "Green Valley Homestay" });
  });

  test("catches an invented nearestLandmark and seasonalNotes independently", () => {
    const transcript = "My place is called Green Valley Homestay.";
    const extraction = { ...fullValidExtraction(), amenities: [], meals: [] };

    const result = checkExtractionHonesty(extraction, transcript);

    expect(result.honest).toBe(false);
    expect(result.failedFields).toContainEqual({ field: "nearestLandmark", value: "Main Chowk" });
    expect(result.failedFields).toContainEqual({ field: "seasonalNotes", value: "closed in monsoon" });
  });

  test("reports every failed field, not just the first", () => {
    const transcript = "Hello.";
    const extraction = fullValidExtraction();

    const result = checkExtractionHonesty(extraction, transcript);

    expect(result.honest).toBe(false);
    // name, nearestLandmark, seasonalNotes, 2 amenities, 1 meal = 6 free-text claims, all unmatched.
    expect(result.failedFields).toHaveLength(6);
  });

  test("skips null fields entirely — a null claim can't be invented", () => {
    const transcript = "Just a plain transcript with nothing extra.";
    const extraction = allNullExtraction();

    const result = checkExtractionHonesty(extraction, transcript);

    expect(result).toEqual({ honest: true, failedFields: [] });
  });

  test("does not check type, capacity, priceRangeINR, or languages", () => {
    // None of these values appear anywhere in the transcript, but none of
    // them are free-text claims this check is meant to catch.
    const transcript = "A short transcript mentioning nothing else.";
    const extraction = {
      name: null,
      type: "homestay",
      capacity: 4,
      priceRangeINR: { min: 1000, max: 2000 },
      amenities: [],
      meals: [],
      nearestLandmark: null,
      languages: ["hi", "en"],
      seasonalNotes: null,
    };

    const result = checkExtractionHonesty(extraction, transcript);

    expect(result).toEqual({ honest: true, failedFields: [] });
  });

  test("is case-insensitive and tolerant of extra whitespace/punctuation", () => {
    const transcript = "  We're near   MAIN   CHOWK,   right in the center.  ";
    const extraction = { ...allNullExtraction(), nearestLandmark: "Main Chowk" };

    const result = checkExtractionHonesty(extraction, transcript);

    expect(result).toEqual({ honest: true, failedFields: [] });
  });

  test("known limitation: different phrasing for the same real fact is flagged as invented", () => {
    // The operator said "geyser available" but extraction normalized it to
    // "hot water" — a real amenity, worded differently. Exact substring
    // matching cannot tell these apart from a genuine invention.
    const transcript = "We have a geyser available and parking.";
    const extraction = { ...allNullExtraction(), amenities: ["hot water", "parking"] };

    const result = checkExtractionHonesty(extraction, transcript);

    expect(result.honest).toBe(false);
    expect(result.failedFields).toContainEqual({ field: "amenities[0]", value: "hot water" });
  });
});
