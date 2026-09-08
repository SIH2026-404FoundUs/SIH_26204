// Voice Onboarding — bharani-tasks.md Section 1.3 extraction schema + post-check.
//
// Pure logic only: no Qwen3 call lives here. This module receives whatever
// an extraction call already produced (via dependency injection at the
// caller level, the same way eligibility.js takes pressureFn instead of
// importing services/pressure/service.js statically) and does two
// independent jobs on that data:
//
//   1. validateExtractionShape — does this object actually match the
//      strict schema (right types, right enum, no surprise fields)?
//   2. checkExtractionHonesty  — does every string claim in it actually
//      appear, in substance, in the transcript it was supposedly drawn
//      from? ("an invented amenity is a correctness bug, not a stylistic
//      nicety")

export const EXTRACTION_TYPE_VALUES = ["homestay", "guesthouse", "guide", "driver", "cook"];

const isNullableString = (v) => v === null || typeof v === "string";
const isStringArray = (v) => Array.isArray(v) && v.every((item) => typeof item === "string");
const isNullableInteger = (v) => v === null || Number.isInteger(v);

function isValidPriceRange(v) {
  if (v === null) return true;
  if (typeof v !== "object" || Array.isArray(v)) return false;
  const keys = Object.keys(v);
  return keys.length === 2 && Number.isInteger(v.min) && Number.isInteger(v.max);
}

// One validator per Section 1.3 field. Order here is the canonical field list.
const FIELD_VALIDATORS = {
  name: isNullableString,
  type: (v) => v === null || EXTRACTION_TYPE_VALUES.includes(v),
  capacity: isNullableInteger,
  priceRangeINR: isValidPriceRange,
  amenities: isStringArray,
  meals: isStringArray,
  nearestLandmark: isNullableString,
  languages: isStringArray,
  seasonalNotes: isNullableString,
};

const EXPECTED_FIELDS = Object.keys(FIELD_VALIDATORS);

/**
 * Confirms `rawExtraction` matches Section 1.3's strict schema exactly:
 * every field present, every field's type/enum correct, no extra fields.
 * Rejects malformed input rather than coercing it into shape.
 *
 * @param {*} rawExtraction - whatever the extraction call returned.
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateExtractionShape(rawExtraction) {
  if (rawExtraction === null || typeof rawExtraction !== "object" || Array.isArray(rawExtraction)) {
    return { valid: false, errors: ["extraction must be a plain object"] };
  }

  const errors = [];

  for (const key of Object.keys(rawExtraction)) {
    if (!EXPECTED_FIELDS.includes(key)) {
      errors.push(`unexpected field: "${key}"`);
    }
  }

  for (const field of EXPECTED_FIELDS) {
    if (!(field in rawExtraction)) {
      errors.push(`missing field: "${field}"`);
      continue;
    }
    if (!FIELD_VALIDATORS[field](rawExtraction[field])) {
      errors.push(`invalid field: "${field}"`);
    }
  }

  return { valid: errors.length === 0, errors };
}

function normalize(text) {
  return String(text).toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Section 1.3 post-check: every non-null free-text string claim in
 * `extraction` must appear, in substance, in `transcript`. Checks `name`,
 * `nearestLandmark`, `seasonalNotes`, and every element of `amenities`/
 * `meals` — the fields a transcript could actually be expected to contain
 * verbatim-ish. `type` (an enum) and `capacity`/`priceRangeINR` (numbers)
 * are excluded: they aren't free text, so "does this substring appear in
 * the transcript" isn't a meaningful honesty check for them.
 *
 * `languages` is deliberately excluded too: its values are ISO-style
 * language codes ("hi", "en") describing the detected speech language,
 * not literal words the speaker said, so substring-matching them against
 * the transcript would produce near-universal false positives rather than
 * catching real invention.
 *
 * Known limitation (matches the "exact substring match is fine as a first
 * pass" instruction): this is a case-insensitive substring check, not
 * semantic matching. A real field that the transcript expresses with
 * different phrasing (e.g. extraction says "hot water", transcript says
 * "geyser available") will be flagged as a false positive here. That's an
 * accepted gap for this pass, not a claim of full honesty verification.
 *
 * @param {Object} extraction - an object matching Section 1.3's schema.
 * @param {string} transcript - the transcript the extraction was drawn from.
 * @returns {{ honest: boolean, failedFields: Array<{ field: string, value: string }> }}
 */
export function checkExtractionHonesty(extraction, transcript) {
  const normalizedTranscript = normalize(transcript ?? "");
  const failedFields = [];

  function check(field, value) {
    if (value === null || value === undefined) return;
    if (!normalizedTranscript.includes(normalize(value))) {
      failedFields.push({ field, value });
    }
  }

  check("name", extraction?.name);
  check("nearestLandmark", extraction?.nearestLandmark);
  check("seasonalNotes", extraction?.seasonalNotes);

  (extraction?.amenities ?? []).forEach((value, i) => check(`amenities[${i}]`, value));
  (extraction?.meals ?? []).forEach((value, i) => check(`meals[${i}]`, value));

  return { honest: failedFields.length === 0, failedFields };
}
