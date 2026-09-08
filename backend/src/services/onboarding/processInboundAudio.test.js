import { describe, test, expect, jest, beforeAll, afterAll, afterEach } from "@jest/globals";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Business from "../../models/business.model.js";
import { processInboundAudio } from "./processInboundAudio.js";
import { getNextFollowUpQuestion } from "./followUp.js";

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

// sendMessageFn now defaults, at the processInboundAudio level, to a REAL
// WhatsApp send (consistent with transcribeFn/extractFn) -- and none of
// the drafts in this file's other tests supply all six
// REQUIRED_FIELDS_FOR_LIVE, so getNextFollowUpQuestion() will find
// something missing and attempt a send on essentially every test unless
// one is injected. This shared stub keeps every test in this file free of
// any real-network risk; tests that specifically care about send
// behavior use their own dedicated jest.fn() instead.
const stubSendMessage = async () => ({ ok: true });

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
      sendMessageFn: stubSendMessage,
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
      sendMessageFn: stubSendMessage,
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
      sendMessageFn: stubSendMessage,
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
      sendMessageFn: stubSendMessage,
    });

    // Already at EXTRACTING -- since the "second message for an
    // already-progressed draft" fix, this is now correctly PROCESSED
    // (not rejected with already_past_target; see
    // processInboundAudio.test.js's dedicated regression describe block
    // for that fix). extractedFields: null still means "don't attempt
    // extraction" though, so the state stays at EXTRACTING and nothing
    // extraction-related is touched -- the real regression proof here is
    // still what happens to the document, checked below.
    expect(result.applied).toBe(true);
    expect(result.onboardingState).toBe("EXTRACTING");
    expect(result.extraction).toEqual({ attempted: false });

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
      sendMessageFn: stubSendMessage,
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
      sendMessageFn: stubSendMessage,
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
      sendMessageFn: stubSendMessage,
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
      sendMessageFn: stubSendMessage,
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
      sendMessageFn: stubSendMessage,
    });

    expect(result.applied).toBe(true);
    expect(result.onboardingState).toBe("TRANSCRIBING");
    expect(result.extractionAccepted).toBe(false);
    expect(result.extraction.shapeValid).toBe(false);
    expect(result.extraction.shapeErrors.length).toBeGreaterThan(0);
  });
});

describe("processInboundAudio — FOLLOWUP question send", () => {
  test("a message reaching a state with missing required fields triggers a follow-up send with the correct question and phone number", async () => {
    const sendMessageFn = jest.fn().mockResolvedValue({ ok: true });

    const result = await processInboundAudio({
      audioBuffer: Buffer.from("audio"),
      ownerPhone: "919000000011",
      destId: "shimla", // one required field present...
      messageId: "wamid.11",
      transcribeFn: async () => ({ transcript: "hello", detectedLanguage: "en" }),
      extractFn: async () => emptyExtraction(), // ...but nothing else was actually stated
      sendMessageFn,
    });

    expect(result.applied).toBe(true);
    expect(sendMessageFn).toHaveBeenCalledTimes(1);
    // name is first in REQUIRED_FIELDS_FOR_LIVE's order and still missing
    // here — derive the expected text from the real function rather than
    // hardcoding English wording a second time in this test.
    const expectedQuestion = getNextFollowUpQuestion({ destId: "shimla" }, "en");
    expect(sendMessageFn).toHaveBeenCalledWith("919000000011", expectedQuestion);
  });

  test("a fully-complete draft (every required field already known) does NOT trigger a follow-up send", async () => {
    await Business.create({
      _id: "biz_test_complete_no_send",
      destId: "shimla",
      ownerPhone: "919000000010",
      onboardingState: "AWAITING_VOICE",
      name: "Complete Homestay",
      type: "homestay",
      capacity: 4,
      priceRangeINR: { min: 1000, max: 2000 },
      nearestLandmark: "Main Chowk",
    });

    const sendMessageFn = jest.fn().mockResolvedValue({ ok: true });

    const result = await processInboundAudio({
      audioBuffer: Buffer.from("audio"),
      ownerPhone: "919000000010",
      messageId: "wamid.10",
      transcribeFn: stubTranscribe,
      extractFn: async () => emptyExtraction(), // nothing new stated, nothing clobbered
      sendMessageFn,
    });

    expect(result.applied).toBe(true);
    const saved = await Business.findOne({ _id: "biz_test_complete_no_send" });
    expect(getNextFollowUpQuestion(saved, "en")).toBeNull(); // sanity: fixture really is complete
    expect(sendMessageFn).not.toHaveBeenCalled();
  });

  test("a send failure is caught and logged without affecting the persisted draft state", async () => {
    const failingSend = jest.fn().mockRejectedValue(new Error("Meta returned 500"));
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    try {
      const result = await processInboundAudio({
        audioBuffer: Buffer.from("audio"),
        ownerPhone: "919000000012",
        destId: "shimla",
        messageId: "wamid.12",
        transcribeFn: async () => ({ transcript: "hello", detectedLanguage: "en" }),
        extractFn: async () => emptyExtraction(),
        sendMessageFn: failingSend,
      });

      // The pipeline's own result is unaffected -- extraction/state
      // advancement already succeeded before the send was even attempted,
      // and a failed send must not undo it.
      expect(result.applied).toBe(true);
      expect(result.onboardingState).toBe("EXTRACTING");

      const saved = await Business.findOne({ ownerPhone: "919000000012" });
      expect(saved.onboardingState).toBe("EXTRACTING");

      expect(failingSend).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("failed to send follow-up question")
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});

describe("processInboundAudio — a SECOND message for an already-progressed draft (regression)", () => {
  // Directly reproduces the bug confirmed before this fix: walkStates(...,
  // "TRANSCRIBING", ...) targets a fixed ceiling, so once a draft reaches
  // EXTRACTING (which a successful first message does, within the same
  // call), every subsequent message -- including a real reply to a
  // getNextFollowUpQuestion() question -- was rejected outright with
  // already_past_target, before any transcription/extraction/merge. The
  // EXTRACTING->EXTRACTING self-transition had the identical problem one
  // level deeper.
  test("message 2 (a genuinely new messageId) supplying a previously-missing field is correctly merged, not rejected", async () => {
    const ownerPhone = "919000000020";

    // Message 1: first-ever voice note. Honest extraction, capacity still
    // unknown -> advances to EXTRACTING within this same call.
    const message1 = await processInboundAudio({
      audioBuffer: Buffer.from("audio-1"),
      ownerPhone,
      destId: "shimla",
      messageId: "wamid.followup.1",
      transcribeFn: async () => ({
        transcript: "This is Ramesh's Homestay near Golconda Fort.",
        detectedLanguage: "en",
      }),
      extractFn: async () => ({
        name: "Ramesh's Homestay",
        type: "homestay",
        capacity: null,
        priceRangeINR: null,
        amenities: [],
        meals: [],
        nearestLandmark: "Golconda Fort",
        languages: [],
        seasonalNotes: null,
      }),
      sendMessageFn: stubSendMessage,
    });

    expect(message1.applied).toBe(true);
    expect(message1.onboardingState).toBe("EXTRACTING");

    const afterMessage1 = await Business.findOne({ ownerPhone });
    expect(afterMessage1.onboardingState).toBe("EXTRACTING");
    expect(afterMessage1.capacity).toBeUndefined();

    // Message 2: the operator's real reply to the "how many guests"
    // follow-up question -- a genuinely new messageId, not a replay.
    const message2 = await processInboundAudio({
      audioBuffer: Buffer.from("audio-2"),
      ownerPhone,
      messageId: "wamid.followup.2",
      transcribeFn: async () => ({ transcript: "We can host six guests.", detectedLanguage: "en" }),
      extractFn: async () => ({
        name: null,
        type: null,
        capacity: 6,
        priceRangeINR: null,
        amenities: [],
        meals: [],
        nearestLandmark: null,
        languages: [],
        seasonalNotes: null,
      }),
      sendMessageFn: stubSendMessage,
    });

    // The core regression: this must NOT be already_past_target.
    expect(message2.applied).toBe(true);
    expect(message2.reason).toBeUndefined();
    expect(message2.onboardingState).toBe("EXTRACTING");
    expect(message2.extractionAccepted).toBe(true);

    const afterMessage2 = await Business.findOne({ ownerPhone });
    expect(afterMessage2.onboardingState).toBe("EXTRACTING");
    expect(afterMessage2.capacity).toBe(6);
    // Message 1's fields survive -- the null-filtering merge fix still
    // applies on this second message (name/type weren't restated).
    expect(afterMessage2.name).toBe("Ramesh's Homestay");
    expect(afterMessage2.type).toBe("homestay");
    expect(afterMessage2.nearestLandmark).toBe("Golconda Fort");
  });

  test("message 3, replaying message 2's exact messageId, correctly no-ops (idempotency still intact)", async () => {
    const ownerPhone = "919000000021";

    await processInboundAudio({
      audioBuffer: Buffer.from("audio-1"),
      ownerPhone,
      destId: "shimla",
      messageId: "wamid.idempotency.1",
      transcribeFn: async () => ({ transcript: "This is a homestay.", detectedLanguage: "en" }),
      extractFn: async () => emptyExtraction(),
      sendMessageFn: stubSendMessage,
    });

    const transcribeFn2 = jest.fn().mockResolvedValue({ transcript: "We can host six guests.", detectedLanguage: "en" });
    const extractFn2 = jest.fn().mockResolvedValue({
      name: null,
      type: null,
      capacity: 6,
      priceRangeINR: null,
      amenities: [],
      meals: [],
      nearestLandmark: null,
      languages: [],
      seasonalNotes: null,
    });

    const message2 = await processInboundAudio({
      audioBuffer: Buffer.from("audio-2"),
      ownerPhone,
      messageId: "wamid.idempotency.2",
      transcribeFn: transcribeFn2,
      extractFn: extractFn2,
      sendMessageFn: stubSendMessage,
    });
    expect(message2.applied).toBe(true);
    expect(message2.onboardingState).toBe("EXTRACTING");

    const afterMessage2 = await Business.findOne({ ownerPhone });
    expect(afterMessage2.capacity).toBe(6);

    // Message 3: Meta retries the identical delivery -- same messageId as
    // message 2, not a genuinely new message.
    const message3 = await processInboundAudio({
      audioBuffer: Buffer.from("audio-2"),
      ownerPhone,
      messageId: "wamid.idempotency.2", // identical to message 2's
      transcribeFn: transcribeFn2,
      extractFn: extractFn2,
      sendMessageFn: stubSendMessage,
    });

    expect(message3.applied).toBe(false);
    expect(message3.reason).toBe("duplicate_message");
    // No re-transcription, no re-extraction, no re-send for the replay.
    expect(transcribeFn2).toHaveBeenCalledTimes(1);
    expect(extractFn2).toHaveBeenCalledTimes(1);

    const afterMessage3 = await Business.findOne({ ownerPhone });
    expect(afterMessage3.capacity).toBe(6); // untouched, still whatever message 2 set
    expect(afterMessage3.onboardingState).toBe("EXTRACTING");
  });
});
