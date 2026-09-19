import { describe, test, expect, jest, beforeAll, afterAll, beforeEach, afterEach } from "@jest/globals";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Business from "../../models/business.model.js";
import BusinessAvailability from "../../models/businessAvailability.model.js";
import {
  buildDraftConfirmationMessage,
  formatAvailabilityRange,
  isConfirmationReply,
  parsePriceCorrection,
  parseDraftCorrection,
  processDraftConfirmReply,
  getClarificationMessage,
  getLiveConfirmedMessage,
} from "./draftConfirm.js";
import { processInboundAudio } from "./processInboundAudio.js";
import { createReceiveWebhookHandler } from "../../controllers/whatsappWebhook.controller.js";

let mongod;
const stubAudio = Buffer.from("fake-audio-bytes");

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await BusinessAvailability.init();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await Business.deleteMany({});
  await BusinessAvailability.deleteMany({});
});

describe("DRAFT_CONFIRM unit tests", () => {
  test("formatAvailabilityRange formats single-date, same-month range, and cross-month range", () => {
    const d1 = new Date(Date.UTC(2026, 9, 10)); // Oct 10
    const d2 = new Date(Date.UTC(2026, 9, 20)); // Oct 20
    const d3 = new Date(Date.UTC(2026, 10, 5)); // Nov 5

    expect(formatAvailabilityRange([{ date: d1 }])).toBe("Oct 10");
    expect(formatAvailabilityRange([{ date: d1 }, { date: d2 }])).toBe("Oct 10–20");
    expect(formatAvailabilityRange([{ date: d1 }, { date: d3 }])).toBe("Oct 10 – Nov 5");
    expect(formatAvailabilityRange([])).toBe("Not specified");
  });

  test("isConfirmationReply recognizes standard English and Hindi confirmations and rejects ambiguous ones", () => {
    // Valid confirmations
    expect(isConfirmationReply("YES")).toBe(true);
    expect(isConfirmationReply("yes")).toBe(true);
    expect(isConfirmationReply("Yes, confirm")).toBe(true);
    expect(isConfirmationReply("Haan")).toBe(true);
    expect(isConfirmationReply("haan confirm")).toBe(true);
    expect(isConfirmationReply("ha")).toBe(true);
    expect(isConfirmationReply("हाँ")).toBe(true);
    expect(isConfirmationReply("हां")).toBe(true);
    expect(isConfirmationReply("sahi hai")).toBe(true);

    // Ambiguous replies
    expect(isConfirmationReply("Maybe tomorrow")).toBe(false);
    expect(isConfirmationReply("What is the price?")).toBe(false);
    expect(isConfirmationReply("Wait a moment")).toBe(false);
    expect(isConfirmationReply("Hello")).toBe(false);
    expect(isConfirmationReply("I have 4 rooms")).toBe(false);
  });

  test("parsePriceCorrection parses price numbers from various phrases", () => {
    expect(parsePriceCorrection("The price is 3000")).toBe(3000);
    expect(parsePriceCorrection("price is 2500")).toBe(2500);
    expect(parsePriceCorrection("₹3000/night")).toBe(3000);
    expect(parsePriceCorrection("Rs. 1500")).toBe(1500);
    expect(parsePriceCorrection("keemat 2000 hai")).toBe(2000);
    expect(parsePriceCorrection("hello world")).toBeNull();
  });
});

describe("DRAFT_CONFIRM listing summary generation", () => {
  test("confirmation summary uses actual stored Business values, availability, and photo count", async () => {
    const biz = await Business.create({
      _id: "biz_draft_summary_1",
      name: "Green Valley Homestay",
      type: "homestay",
      ownerPhone: "919222222201",
      destId: "golconda",
      nearestLandmark: "Near Golconda Fort",
      capacity: 3,
      priceRangeINR: { min: 2500, max: 2500 },
      photos: ["photo1.jpg", "photo2.jpg", "photo3.jpg"],
      onboardingState: "DRAFT_CONFIRM",
      transcriptLang: "en",
    });

    // Add availability records Oct 10 to Oct 20
    const d1 = new Date(Date.UTC(2026, 9, 10));
    const d2 = new Date(Date.UTC(2026, 9, 20));
    await BusinessAvailability.create({
      _id: "avail_summary_1",
      businessId: biz._id,
      date: d1,
      resourceType: "room",
      units: { total: 3, available: 3 },
      pricePerNight: 2500,
      isOpen: true,
      source: "business_declared",
    });
    await BusinessAvailability.create({
      _id: "avail_summary_2",
      businessId: biz._id,
      date: d2,
      resourceType: "room",
      units: { total: 3, available: 3 },
      pricePerNight: 2500,
      isOpen: true,
      source: "business_declared",
    });

    const summary = await buildDraftConfirmationMessage(biz._id, "en");

    expect(summary).toContain("Please confirm your listing:");
    expect(summary).toContain("Name: Green Valley Homestay");
    expect(summary).toContain("Location: Near Golconda Fort");
    expect(summary).toContain("Rooms: 3");
    expect(summary).toContain("Price: ₹2500/night");
    expect(summary).toContain("Availability: Oct 10–20");
    expect(summary).toContain("Photos: 3");
    expect(summary).toContain("Reply YES to confirm, or tell me what you would like to change.");
  });

  test("Telugu draft confirmation summary contains Telugu headers and footers", async () => {
    const biz = await Business.create({
      _id: "biz_draft_summary_te",
      name: "Araku Valley Homestay",
      type: "homestay",
      ownerPhone: "919222222202",
      destId: "araku",
      nearestLandmark: "Near Coffee Museum",
      capacity: 3,
      priceRangeINR: { min: 1500, max: 2000 },
      photos: ["p1.jpg", "p2.jpg"],
      onboardingState: "DRAFT_CONFIRM",
      transcriptLang: "te",
    });

    const summary = await buildDraftConfirmationMessage(biz._id, "te", { includeIntro: true });

    expect(summary).toContain("మీ లభ్యత తేదీలు మరియు యూనిట్లు నమోదు చేయబడ్డాయి.");
    expect(summary).toContain("దయచేసి మీ లిస్టింగ్‌ను నిర్ధారించండి");
    expect(summary).toContain("Name: Araku Valley Homestay");
    expect(summary).toContain("Location: Near Coffee Museum");
    expect(summary).toContain("నిర్ధారించడానికి YES అని పంపండి");
  });

  test("getClarificationMessage and getLiveConfirmedMessage return correct language and fallback", () => {
    expect(getClarificationMessage("te")).toMatch(/[\u0C00-\u0C7F]/);
    expect(getClarificationMessage("hi")).toMatch(/[ऀ-ॿ]/);
    expect(getClarificationMessage("en")).toContain("We could not understand your reply");
    expect(getClarificationMessage("unknown")).toBe(getClarificationMessage("en"));

    expect(getLiveConfirmedMessage("te")).toMatch(/[\u0C00-\u0C7F]/);
    expect(getLiveConfirmedMessage("hi")).toMatch(/[ऀ-ॿ]/);
    expect(getLiveConfirmedMessage("en")).toContain("Congratulations! Your listing is now LIVE");
    expect(getLiveConfirmedMessage("unknown")).toBe(getLiveConfirmedMessage("en"));
  });
});

describe("DRAFT_CONFIRM confirmation flow", () => {
  beforeEach(async () => {
    await Business.create({
      _id: "biz_draft_confirm_1",
      name: "Sunrise Homestay",
      type: "homestay",
      ownerPhone: "919333333301",
      destId: "shimla",
      nearestLandmark: "Mall Road",
      capacity: 2,
      priceRangeINR: { min: 2000, max: 2000 },
      photos: ["p1.jpg", "p2.jpg", "p3.jpg"],
      onboardingState: "DRAFT_CONFIRM",
      transcriptLang: "en",
    });
  });

  test("YES → LIVE and sets verificationTier to 'self-declared'", async () => {
    const sendMessageFn = jest.fn();

    const result = await processDraftConfirmReply({
      ownerPhone: "919333333301",
      text: "YES",
      messageId: "wamid.confirm.1",
      sendMessageFn,
    });

    expect(result.applied).toBe(true);
    expect(result.outcome).toBe("confirmed_live");
    expect(result.onboardingState).toBe("LIVE");
    expect(result.verificationTier).toBe("self-declared");

    const saved = await Business.findOne({ _id: "biz_draft_confirm_1" });
    expect(saved.onboardingState).toBe("LIVE");
    expect(saved.verificationTier).toBe("self-declared");
    expect(saved.lastWhatsAppMessageId).toBe("wamid.confirm.1");

    expect(sendMessageFn).toHaveBeenCalledWith(
      "919333333301",
      expect.stringContaining("LIVE")
    );
  });

  test("simple Hindi confirmation 'Haan' → LIVE", async () => {
    const sendMessageFn = jest.fn();

    const result = await processDraftConfirmReply({
      ownerPhone: "919333333301",
      text: "Haan",
      messageId: "wamid.confirm.2",
      sendMessageFn,
      language: "hi",
    });

    expect(result.applied).toBe(true);
    expect(result.onboardingState).toBe("LIVE");

    const saved = await Business.findOne({ _id: "biz_draft_confirm_1" });
    expect(saved.onboardingState).toBe("LIVE");
    expect(saved.verificationTier).toBe("self-declared");
  });

  test("Telugu confirmation 'yes I confirm' → LIVE and sends Telugu live confirmation", async () => {
    const sendMessageFn = jest.fn();

    const result = await processDraftConfirmReply({
      ownerPhone: "919333333301",
      text: "yes I confirm",
      messageId: "wamid.confirm.te.1",
      sendMessageFn,
      language: "te",
    });

    expect(result.applied).toBe(true);
    expect(result.onboardingState).toBe("LIVE");

    const saved = await Business.findOne({ _id: "biz_draft_confirm_1" });
    expect(saved.onboardingState).toBe("LIVE");
    expect(saved.verificationTier).toBe("self-declared");

    expect(sendMessageFn).toHaveBeenCalledWith(
      "919333333301",
      expect.stringMatching(/[\u0C00-\u0C7F]/)
    );
  });

  test("ambiguous reply does not transition to LIVE and asks for clarification", async () => {
    const sendMessageFn = jest.fn();

    const result = await processDraftConfirmReply({
      ownerPhone: "919333333301",
      text: "Maybe tomorrow, I need to check with my family",
      messageId: "wamid.ambig.1",
      sendMessageFn,
    });

    expect(result.applied).toBe(false);
    expect(result.outcome).toBe("clarification_requested");
    expect(result.onboardingState).toBe("DRAFT_CONFIRM");

    const saved = await Business.findOne({ _id: "biz_draft_confirm_1" });
    expect(saved.onboardingState).toBe("DRAFT_CONFIRM");

    expect(sendMessageFn).toHaveBeenCalledWith(
      "919333333301",
      expect.stringContaining("reply YES to confirm")
    );
  });

  test("duplicate message is not processed twice (idempotency)", async () => {
    const sendMessageFn = jest.fn();

    // First attempt
    const r1 = await processDraftConfirmReply({
      ownerPhone: "919333333301",
      text: "YES",
      messageId: "wamid.dup.1",
      sendMessageFn,
    });
    expect(r1.applied).toBe(true);
    expect(sendMessageFn).toHaveBeenCalledTimes(1);

    // Replay with identical messageId
    const r2 = await processDraftConfirmReply({
      ownerPhone: "919333333301",
      text: "YES",
      messageId: "wamid.dup.1",
      sendMessageFn,
    });
    expect(r2.applied).toBe(false);
    expect(r2.reason).toBe("duplicate_message");
    expect(sendMessageFn).toHaveBeenCalledTimes(1); // not called again
  });
});

describe("DRAFT_CONFIRM correction flow", () => {
  beforeEach(async () => {
    await Business.create({
      _id: "biz_draft_corr_1",
      name: "Valley View Stay",
      type: "homestay",
      ownerPhone: "919444444401",
      destId: "shimla",
      nearestLandmark: "Old Bridge",
      capacity: 2,
      priceRangeINR: { min: 2000, max: 2000 },
      photos: ["p1.jpg", "p2.jpg", "p3.jpg"],
      onboardingState: "DRAFT_CONFIRM",
      transcriptLang: "en",
    });

    await BusinessAvailability.create({
      _id: "avail_corr_1",
      businessId: "biz_draft_corr_1",
      date: new Date(Date.UTC(2026, 9, 15)),
      resourceType: "room",
      units: { total: 2, available: 2 },
      pricePerNight: 2000,
      isOpen: true,
      source: "business_declared",
    });
  });

  test("valid room correction updates Business, stays in DRAFT_CONFIRM, sends updated summary", async () => {
    const sendMessageFn = jest.fn();

    const result = await processDraftConfirmReply({
      ownerPhone: "919444444401",
      text: "I have 4 rooms",
      messageId: "wamid.corr.rooms",
      sendMessageFn,
    });

    expect(result.applied).toBe(true);
    expect(result.outcome).toBe("correction_applied");
    expect(result.onboardingState).toBe("DRAFT_CONFIRM");
    expect(result.updates.capacity).toBe(4);

    const savedBiz = await Business.findOne({ _id: "biz_draft_corr_1" });
    expect(savedBiz.capacity).toBe(4);
    expect(savedBiz.onboardingState).toBe("DRAFT_CONFIRM");

    // Check availability units also updated
    const savedAvail = await BusinessAvailability.findOne({ _id: "avail_corr_1" });
    expect(savedAvail.units).toEqual({ total: 4, available: 4 });

    // Verify updated summary message sent with Rooms: 4
    expect(sendMessageFn).toHaveBeenCalledTimes(1);
    expect(sendMessageFn).toHaveBeenCalledWith(
      "919444444401",
      expect.stringContaining("Rooms: 4")
    );
  });

  test("valid price correction updates Business, stays in DRAFT_CONFIRM, sends updated summary", async () => {
    const sendMessageFn = jest.fn();

    const result = await processDraftConfirmReply({
      ownerPhone: "919444444401",
      text: "The price is 3000",
      messageId: "wamid.corr.price",
      sendMessageFn,
    });

    expect(result.applied).toBe(true);
    expect(result.outcome).toBe("correction_applied");
    expect(result.onboardingState).toBe("DRAFT_CONFIRM");
    expect(result.updates.priceRangeINR).toEqual({ min: 3000, max: 3000 });

    const savedBiz = await Business.findOne({ _id: "biz_draft_corr_1" });
    expect(savedBiz.priceRangeINR.min).toBe(3000);
    expect(savedBiz.onboardingState).toBe("DRAFT_CONFIRM");

    // Verify updated summary message sent with Price: ₹3000/night
    expect(sendMessageFn).toHaveBeenCalledTimes(1);
    expect(sendMessageFn).toHaveBeenCalledWith(
      "919444444401",
      expect.stringContaining("Price: ₹3000/night")
    );
  });

  test("unclear correction asks for clarification and does not modify draft", async () => {
    const sendMessageFn = jest.fn();

    const result = await processDraftConfirmReply({
      ownerPhone: "919444444401",
      text: "change something please",
      messageId: "wamid.corr.unclear",
      sendMessageFn,
    });

    expect(result.applied).toBe(false);
    expect(result.outcome).toBe("clarification_requested");
    expect(result.onboardingState).toBe("DRAFT_CONFIRM");

    const savedBiz = await Business.findOne({ _id: "biz_draft_corr_1" });
    expect(savedBiz.capacity).toBe(2);
    expect(savedBiz.priceRangeINR.min).toBe(2000);
    expect(savedBiz.onboardingState).toBe("DRAFT_CONFIRM");

    expect(sendMessageFn).toHaveBeenCalledWith(
      "919444444401",
      expect.stringContaining("We could not understand your reply")
    );
  });
});

describe("DRAFT_CONFIRM voice and webhook integration", () => {
  beforeEach(async () => {
    await Business.create({
      _id: "biz_integ_1",
      name: "Mountain Nest",
      type: "homestay",
      ownerPhone: "919555555501",
      destId: "shimla",
      nearestLandmark: "Pine Hill",
      capacity: 3,
      priceRangeINR: { min: 2200, max: 2200 },
      photos: ["p1.jpg", "p2.jpg", "p3.jpg"],
      onboardingState: "DRAFT_CONFIRM",
      transcriptLang: "en",
    });
  });

  test("voice confirmation works through existing transcription in processInboundAudio", async () => {
    const sendMessageFn = jest.fn();
    const transcribeFn = async () => ({
      transcript: "Yes, confirm",
      detectedLanguage: "en",
    });

    const result = await processInboundAudio({
      audioBuffer: stubAudio,
      ownerPhone: "919555555501",
      messageId: "wamid.voice.confirm.1",
      transcribeFn,
      sendMessageFn,
    });

    expect(result.applied).toBe(true);
    expect(result.onboardingState).toBe("LIVE");

    const saved = await Business.findOne({ _id: "biz_integ_1" });
    expect(saved.onboardingState).toBe("LIVE");
    expect(saved.verificationTier).toBe("self-declared");
  });

  test("text webhook payload reaches DRAFT_CONFIRM handler and transitions to LIVE", async () => {
    const sendMessageFn = jest.fn();
    const handler = createReceiveWebhookHandler({ sendMessageFn });

    const req = {
      body: {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "wh_entry_1",
            changes: [
              {
                field: "messages",
                value: {
                  messaging_product: "whatsapp",
                  messages: [
                    {
                      from: "919555555501",
                      id: "wamid.text.webhook.1",
                      timestamp: "1725800000",
                      type: "text",
                      text: { body: "YES" },
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    };

    const res = {
      sendStatus: jest.fn().mockReturnThis(),
    };

    handler(req, res);
    expect(res.sendStatus).toHaveBeenCalledWith(200);

    // Await background work
    await Promise.all(handler.pendingWork);

    const saved = await Business.findOne({ _id: "biz_integ_1" });
    expect(saved.onboardingState).toBe("LIVE");
    expect(saved.verificationTier).toBe("self-declared");
    expect(sendMessageFn).toHaveBeenCalledWith(
      "919555555501",
      expect.stringContaining("LIVE")
    );
  });
});
