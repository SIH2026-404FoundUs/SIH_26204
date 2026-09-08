import { describe, test, expect, beforeAll, afterAll, afterEach } from "@jest/globals";
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

describe("processInboundAudio — destId handling", () => {
  test("a brand-new draft (no existing document) with no destId supplied fails clearly, not silently", async () => {
    await expect(
      processInboundAudio({
        audioBuffer: Buffer.from("audio"),
        ownerPhone: "919000000001", // no Business document exists for this number
        messageId: "wamid.1",
        transcribeFn: stubTranscribe,
      })
    ).rejects.toThrow(/no existing draft.*no destId provided/i);

    const saved = await Business.findOne({ ownerPhone: "919000000001" });
    expect(saved).toBeNull(); // no partial/invalid document was written
  });

  test("a brand-new draft WITH destId supplied succeeds normally", async () => {
    const result = await processInboundAudio({
      audioBuffer: Buffer.from("audio"),
      ownerPhone: "919000000002",
      destId: "shimla",
      messageId: "wamid.2",
      transcribeFn: stubTranscribe,
    });

    expect(result.applied).toBe(true);
    // extractedFields wasn't passed at all (undefined) — treated as
    // "extraction not attempted," so the draft stops at TRANSCRIBING
    // rather than advancing to EXTRACTING on a placeholder.
    expect(result.onboardingState).toBe("TRANSCRIBING");
    expect(result.extraction).toEqual({ attempted: false });

    const saved = await Business.findOne({ ownerPhone: "919000000002" });
    expect(saved.destId).toBe("shimla");
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
      // no destId — the webhook path never has one to give
    });

    expect(result.applied).toBe(true);
    // Same as the sibling test above: no extractedFields supplied means
    // extraction wasn't attempted, so this stops at TRANSCRIBING.
    expect(result.onboardingState).toBe("TRANSCRIBING");

    const saved = await Business.findOne({ _id: "biz_test_continuing" });
    expect(saved.destId).toBe("manali"); // untouched, not cleared
  });
});

describe("processInboundAudio — extraction not attempted must not clobber existing data", () => {
  test("a second voice message with no extractedFields leaves previously-extracted name/type/priceRangeINR untouched", async () => {
    // Simulates the real bug: a draft already has real extracted values
    // (e.g. persisted by an earlier message that DID have a real
    // extraction attempt), then a later message comes in with no
    // extraction attempt at all — as every real WhatsApp audio message
    // does today, since no Qwen3/Gemini call is wired into that path yet.
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
      // extractedFields intentionally omitted — matches the real
      // whatsappWebhook.controller.js call shape exactly.
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

  test("a second voice message with no extractedFields, draft mid-onboarding before EXTRACTING, leaves prior real values untouched", async () => {
    // Same clobbering scenario, but from a state where the pipeline DOES
    // run (TRANSCRIBING is still ahead) — this is the case that actually
    // reached Mongo with name/type explicitly nulled before this fix.
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
      // extractedFields intentionally omitted.
    });

    expect(result.applied).toBe(true);
    expect(result.onboardingState).toBe("TRANSCRIBING");
    expect(result.extraction).toEqual({ attempted: false });

    const saved = await Business.findOne({ _id: "biz_test_no_clobber_2" });
    expect(saved.onboardingState).toBe("TRANSCRIBING");
    // The actual regression: these must NOT have been overwritten to null.
    expect(saved.name).toBe("Ramesh's Homestay");
    expect(saved.type).toBe("homestay");
    expect(saved.priceRangeINR.min).toBe(800);
    expect(saved.priceRangeINR.max).toBe(1500);
  });
});
