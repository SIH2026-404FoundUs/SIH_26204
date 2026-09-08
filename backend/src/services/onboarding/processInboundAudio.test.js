import { describe, test, expect, jest, beforeAll, afterAll, afterEach } from "@jest/globals";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Business from "../../models/business.model.js";
import { processInboundAudio } from "./processInboundAudio.js";

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await Business.deleteMany({});
});

const stubTranscribe = async () => ({ transcript: "hello world", detectedLanguage: "en" });

// A shape-valid extraction with every field null/empty — matches
// validateExtractionShape's exact expected-field set (extraction.js),
// so it's "attempted, found nothing to report" rather than "not attempted."
function emptyExtraction() {
  return {
    name: null,
    type: null,
    capacity: null,
    priceRangeINR: null,
    amenities: [],
    meals: [],
    nearestLandmark: null,
    languages: [],
    seasonalNotes: null,
  };
}

describe("processInboundAudio — destId handling", () => {
  test("a brand-new draft (no existing document) with no destId supplied now succeeds, reaching TRANSCRIBING/EXTRACTING without one", async () => {
    // destId's schema requirement is now conditional (business.model.js's
    // requiredUnlessMidOnboarding, same as name/type) — a genuinely new
    // WhatsApp-originated draft has no way to supply one on its first
    // message (no destId RESOLUTION step exists), so this must no longer
    // throw. It's still not LIVE-eligible without one (see
    // stateMachine.test.js's destId-in-REQUIRED_FIELDS_FOR_LIVE coverage).
    const result = await processInboundAudio({
      audioBuffer: Buffer.from("audio"),
      ownerPhone: "919000000001", // no Business document exists for this number
      messageId: "wamid.1",
      transcribeFn: stubTranscribe,
      extractFn: async () => emptyExtraction(),
    });

    expect(result.applied).toBe(true);
    expect(result.onboardingState).toBe("EXTRACTING");

    const saved = await Business.findOne({ ownerPhone: "919000000001" });
    expect(saved).not.toBeNull();
    expect(saved.destId).toBeUndefined();
    expect(saved.onboardingState).toBe("EXTRACTING");
    // Generated _id must not embed the literal string "undefined".
    expect(saved._id).not.toMatch(/undefined/);
  });

  test("a brand-new draft WITH destId supplied succeeds normally", async () => {
    const extractFn = async () => emptyExtraction();

    const result = await processInboundAudio({
      audioBuffer: Buffer.from("audio"),
      ownerPhone: "919000000002",
      destId: "shimla",
      messageId: "wamid.2",
      transcribeFn: stubTranscribe,
      extractFn,
    });

    expect(result.applied).toBe(true);
    // extractedFields omitted -> processInboundAudio calls the real
    // extraction path itself (via extractFn here, a stub). An
    // all-null/empty extraction is shape-valid and trivially honest
    // (nothing non-null to falsify), so it's accepted and the draft
    // advances to EXTRACTING, even though nothing new was actually found.
    expect(result.onboardingState).toBe("EXTRACTING");
    expect(result.extraction).toEqual({
      attempted: true,
      shapeValid: true,
      shapeErrors: [],
      honest: true,
      failedFields: [],
    });

    const saved = await Business.findOne({ ownerPhone: "919000000002" });
    expect(saved.destId).toBe("shimla");
    // Null fields are filtered out of the write, not persisted as null.
    expect(saved.name).toBeUndefined();
    expect(saved.type).toBeUndefined();
  });

  test("a continuing conversation (draft already exists) works with no destId supplied — its existing destId is preserved", async () => {
    await Business.create({
      _id: "biz_test_continuing",
      destId: "manali",
      ownerPhone: "919000000003",
      onboardingState: "AWAITING_VOICE",
    });

    const result = await processInboundAudio({
      audioBuffer: Buffer.from("audio"),
      ownerPhone: "919000000003",
      messageId: "wamid.3",
      transcribeFn: stubTranscribe,
      extractFn: async () => emptyExtraction(),
      // no destId — the webhook path never has one to give
    });

    expect(result.applied).toBe(true);
    expect(result.onboardingState).toBe("EXTRACTING");

    const saved = await Business.findOne({ _id: "biz_test_continuing" });
    expect(saved.destId).toBe("manali"); // untouched, not cleared
  });
});

describe("processInboundAudio — extractedFields: null explicitly opts out of extraction", () => {
  test("a second voice message with extractedFields: null leaves previously-extracted name/type/priceRangeINR untouched", async () => {
    await Business.create({
      _id: "biz_test_no_clobber",
      destId: "manali",
      ownerPhone: "919000000004",
      onboardingState: "EXTRACTING",
      name: "Ramesh's Homestay",
      type: "homestay",
      priceRangeINR: { min: 800, max: 1500 },
    });

    const result = await processInboundAudio({
      audioBuffer: Buffer.from("audio"),
      ownerPhone: "919000000004",
      messageId: "wamid.4",
      transcribeFn: stubTranscribe,
      extractedFields: null, // explicit opt-out, not omission
    });

    // Already at EXTRACTING, which is past TRANSCRIBING (the walk target)
    // — not eligible for another transcription-only hop, so this attempt
    // is correctly rejected outright. The real regression proof is what
    // happens to the document, checked below regardless of this outcome.
    expect(result.applied).toBe(false);

    const saved = await Business.findOne({ _id: "biz_test_no_clobber" });
    expect(saved.name).toBe("Ramesh's Homestay");
    expect(saved.type).toBe("homestay");
    expect(saved.priceRangeINR.min).toBe(800);
    expect(saved.priceRangeINR.max).toBe(1500);
  });

  test("a second voice message with extractedFields: null, draft mid-onboarding before EXTRACTING, leaves prior real values untouched", async () => {
    await Business.create({
      _id: "biz_test_no_clobber_2",
      destId: "manali",
      ownerPhone: "919000000005",
      onboardingState: "AWAITING_VOICE",
      name: "Ramesh's Homestay",
      type: "homestay",
      priceRangeINR: { min: 800, max: 1500 },
    });

    const result = await processInboundAudio({
      audioBuffer: Buffer.from("audio"),
      ownerPhone: "919000000005",
      messageId: "wamid.5",
      transcribeFn: stubTranscribe,
      extractedFields: null,
    });

    expect(result.applied).toBe(true);
    expect(result.onboardingState).toBe("TRANSCRIBING");
    expect(result.extraction).toEqual({ attempted: false });

    const saved = await Business.findOne({ _id: "biz_test_no_clobber_2" });
    expect(saved.onboardingState).toBe("TRANSCRIBING");
    expect(saved.name).toBe("Ramesh's Homestay");
    expect(saved.type).toBe("homestay");
    expect(saved.priceRangeINR.min).toBe(800);
    expect(saved.priceRangeINR.max).toBe(1500);
  });
});

describe("processInboundAudio — real extraction (extractFn) wiring", () => {
  test("extractedFields omitted calls extractFn with the transcript and detected language", async () => {
    const extractFn = jest.fn().mockResolvedValue(emptyExtraction());

    await processInboundAudio({
      audioBuffer: Buffer.from("audio"),
      ownerPhone: "919000000006",
      destId: "shimla",
      messageId: "wamid.6",
      transcribeFn: async () => ({ transcript: "Teen kamre hain, geyser hai.", detectedLanguage: "hi" }),
      extractFn,
    });

    expect(extractFn).toHaveBeenCalledTimes(1);
    expect(extractFn).toHaveBeenCalledWith("Teen kamre hain, geyser hai.", "hi");
  });

  test("a real (stubbed) extraction that omits previously-known fields does not clobber them — only newly-stated fields are updated", async () => {
    // The actual regression this session was built to fix: a draft
    // already has real name/type/priceRangeINR from an earlier successful
    // extraction. A second real voice message only mentions a new
    // capacity, saying nothing about name/type/price this time (entirely
    // normal — nobody restates their whole listing every message). The
    // extraction service honestly returns null for what wasn't said.
    await Business.create({
      _id: "biz_test_real_no_clobber",
      destId: "manali",
      ownerPhone: "919000000007",
      onboardingState: "AWAITING_VOICE",
      name: "Ramesh's Homestay",
      type: "homestay",
      priceRangeINR: { min: 800, max: 1500 },
    });

    const partialExtraction = {
      ...emptyExtraction(),
      capacity: 5, // the only thing actually said this time
    };

    const result = await processInboundAudio({
      audioBuffer: Buffer.from("audio"),
      ownerPhone: "919000000007",
      messageId: "wamid.7",
      transcribeFn: async () => ({ transcript: "Hum paanch log rakh sakte hain.", detectedLanguage: "hi" }),
      extractFn: async () => partialExtraction,
    });

    expect(result.applied).toBe(true);
    expect(result.onboardingState).toBe("EXTRACTING");
    expect(result.extractionAccepted).toBe(true);

    const saved = await Business.findOne({ _id: "biz_test_real_no_clobber" });
    // Not clobbered:
    expect(saved.name).toBe("Ramesh's Homestay");
    expect(saved.type).toBe("homestay");
    expect(saved.priceRangeINR.min).toBe(800);
    expect(saved.priceRangeINR.max).toBe(1500);
    // Actually updated:
    expect(saved.capacity).toBe(5);
  });

  test("the honesty check still fires on real (stubbed) extraction output — an invented claim is rejected, not trusted", async () => {
    // Definition of Done: "verify this actually fires" against real AI
    // output, not just against the old hand-written placeholder tests.
    const dishonestExtraction = {
      ...emptyExtraction(),
      amenities: ["swimming pool"], // never mentioned in the transcript below
    };

    const result = await processInboundAudio({
      audioBuffer: Buffer.from("audio"),
      ownerPhone: "919000000008",
      destId: "shimla",
      messageId: "wamid.8",
      transcribeFn: async () => ({ transcript: "Teen kamre hain, geyser hai.", detectedLanguage: "hi" }),
      extractFn: async () => dishonestExtraction,
    });

    expect(result.applied).toBe(true);
    // Rejected: stays at TRANSCRIBING, does not advance to EXTRACTING.
    expect(result.onboardingState).toBe("TRANSCRIBING");
    expect(result.extractionAccepted).toBe(false);
    expect(result.extraction.attempted).toBe(true);
    expect(result.extraction.honest).toBe(false);
    expect(result.extraction.failedFields).toEqual([{ field: "amenities[0]", value: "swimming pool" }]);

    // The invented amenity must not have been written anywhere.
    const saved = await Business.findOne({ ownerPhone: "919000000008" });
    expect(saved.amenities).toEqual([]);
  });

  test("a shape-invalid extractFn result is rejected by validateExtractionShape, not silently accepted", async () => {
    const malformed = { totally: "wrong shape" };

    const result = await processInboundAudio({
      audioBuffer: Buffer.from("audio"),
      ownerPhone: "919000000009",
      destId: "shimla",
      messageId: "wamid.9",
      transcribeFn: stubTranscribe,
      extractFn: async () => malformed,
    });

    expect(result.applied).toBe(true);
    expect(result.onboardingState).toBe("TRANSCRIBING");
    expect(result.extractionAccepted).toBe(false);
    expect(result.extraction.shapeValid).toBe(false);
    expect(result.extraction.shapeErrors.length).toBeGreaterThan(0);
  });
});
