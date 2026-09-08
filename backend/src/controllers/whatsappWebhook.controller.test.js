import { describe, test, expect, jest, beforeAll, afterAll, afterEach } from "@jest/globals";
import express from "express";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Business from "../models/business.model.js";
import { createReceiveWebhookHandler } from "./whatsappWebhook.controller.js";

let mongod;
const originalWhatsAppToken = process.env.WHATSAPP_TOKEN;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(() => {
  // fetchWhatsAppMedia checks WHATSAPP_TOKEN unconditionally before using
  // the injected fetchFn stub — set explicitly rather than relying on
  // whatever the ambient environment happens to have.
  process.env.WHATSAPP_TOKEN = "test-whatsapp-token-for-webhook-tests";
});

afterEach(async () => {
  process.env.WHATSAPP_TOKEN = originalWhatsAppToken;
  await Business.deleteMany({});
});

// Real-shaped WhatsApp Cloud API inbound-audio-message payload, matching
// the exact structure confirmed against a live test-number send.
function buildAudioWebhookPayload({ from, messageId, mediaId }) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "wa_business_account_id",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "15550001111", phone_number_id: "phone_number_id_123" },
              contacts: [{ profile: { name: "Test Operator" }, wa_id: from }],
              messages: [
                {
                  from,
                  id: messageId,
                  timestamp: "1699999999",
                  type: "audio",
                  audio: { id: mediaId, mime_type: "audio/ogg; codecs=opus" },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

function createTestApp(handler) {
  const app = express();
  app.use(express.json());
  app.post("/api/webhook/whatsapp", handler);
  return app;
}

describe("WhatsApp webhook -> shared pipeline integration", () => {
  test("a real-shaped inbound audio payload downloads media, transcribes, and persists a state change", async () => {
    const ownerPhone = "919876543299"; // Meta's real convention: no leading "+"
    const mediaId = "media_abc_123";
    const messageId = "wamid.HBgLOTE5ODc2NTQzMjk5FQIAEhgg";

    // Draft already exists (e.g. from some earlier interaction) at an
    // in-progress state — proves the webhook path correctly walks it
    // forward, exactly like the internal endpoint does, not a special case.
    // (Not onboardingState: null here: business.model.js's
    // requiredUnlessMidOnboarding() treats a null onboardingState the same
    // as "not part of the onboarding pipeline at all" — e.g. a regular
    // seeded business — and correctly requires name/type in that case, so
    // .create() with no name/type and onboardingState: null would fail
    // validation. A brand-new never-started draft is what
    // processInboundAudio's own upsert-create path produces; that's
    // already covered by processInboundAudio.test.js.)
    await Business.create({
      _id: "biz_test_whatsapp_flow",
      destId: "shimla",
      ownerPhone,
      onboardingState: "AWAITING_VOICE",
    });

    const realAudioBytes = new Uint8Array([9, 8, 7, 6, 5]);
    let metadataCallReceived = null;
    let bytesCallReceived = null;
    const fetchFn = jest.fn(async (url, options) => {
      if (url === `https://graph.facebook.com/v21.0/${mediaId}`) {
        metadataCallReceived = { url, headers: options?.headers };
        return {
          ok: true,
          status: 200,
          json: async () => ({ url: "https://lookaside.fbsbx.com/whatsapp_media/short-lived" }),
        };
      }
      bytesCallReceived = { url, headers: options?.headers };
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () =>
          realAudioBytes.buffer.slice(realAudioBytes.byteOffset, realAudioBytes.byteOffset + realAudioBytes.byteLength),
      };
    });

    const transcript = "Yeh mera ghar hai, teen kamre hain, Main Chowk ke paas.";
    const transcribeFn = jest.fn().mockResolvedValue({ transcript, detectedLanguage: "hi" });

    // A realistic, honest extraction: capacity and nearestLandmark are
    // genuinely stated in the transcript above ("teen kamre" / "Main
    // Chowk"); everything else is left null since it wasn't said. Proves
    // the real extraction path end-to-end, not just that it was called.
    const extractFn = jest.fn().mockResolvedValue({
      name: null,
      type: null,
      capacity: 3,
      priceRangeINR: null,
      amenities: [],
      meals: [],
      nearestLandmark: "Main Chowk",
      languages: ["hi"],
      seasonalNotes: null,
    });

    const handler = createReceiveWebhookHandler({ fetchFn, transcribeFn, extractFn });
    const app = createTestApp(handler);
    const server = app.listen(0);

    try {
      const { port } = server.address();
      const payload = buildAudioWebhookPayload({ from: ownerPhone, messageId, mediaId });

      const response = await fetch(`http://127.0.0.1:${port}/api/webhook/whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // Fast 200, before any processing is awaited — per Meta's requirement.
      expect(response.status).toBe(200);

      // The pipeline is fire-and-forget in production; this is the test
      // hook that lets us wait for it to actually finish.
      await Promise.all(handler.pendingWork);

      // Media was genuinely downloaded via the real two-step flow.
      expect(fetchFn).toHaveBeenCalledTimes(2);
      expect(metadataCallReceived.headers).toMatchObject({ Authorization: expect.stringContaining("Bearer ") });
      expect(bytesCallReceived.headers).toMatchObject({ Authorization: expect.stringContaining("Bearer ") });

      // transcribeAudio() was called with the REAL downloaded bytes, not
      // something fabricated separately.
      expect(transcribeFn).toHaveBeenCalledTimes(1);
      expect(Buffer.isBuffer(transcribeFn.mock.calls[0][0])).toBe(true);
      expect(transcribeFn.mock.calls[0][0]).toEqual(Buffer.from(realAudioBytes));

      // extractedFields was never passed to processInboundAudio (omitted,
      // not null), so it called the real extraction path itself, with the
      // transcript that was just produced.
      expect(extractFn).toHaveBeenCalledTimes(1);
      expect(extractFn).toHaveBeenCalledWith(transcript, "hi");

      // And the actual persisted state change, including the extracted
      // fields — EXTRACTING now that a real (stubbed) extraction ran and
      // was accepted as shape-valid and honest.
      const saved = await Business.findOne({ _id: "biz_test_whatsapp_flow" });
      expect(saved.onboardingState).toBe("EXTRACTING");
      expect(saved.rawTranscript).toBe(transcript);
      expect(saved.transcriptLang).toBe("hi");
      expect(saved.lastWhatsAppMessageId).toBe(messageId);
      expect(saved.capacity).toBe(3);
      expect(saved.nearestLandmark).toBe("Main Chowk");
    } finally {
      server.close();
    }
  });

  test("replaying the same WhatsApp messageId does not re-download media or re-transcribe", async () => {
    const ownerPhone = "919876543298";
    const mediaId = "media_replay_1";
    const messageId = "wamid.replay-test-1";

    await Business.create({
      _id: "biz_test_whatsapp_replay",
      destId: "shimla",
      ownerPhone,
      onboardingState: "AWAITING_VOICE",
      lastWhatsAppMessageId: "wamid.some-earlier-message",
    });

    const fetchFn = jest.fn(async (url) => {
      if (url.includes("graph.facebook.com")) {
        return { ok: true, status: 200, json: async () => ({ url: "https://lookaside.fbsbx.com/x" }) };
      }
      return { ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(4) };
    });
    const transcribeFn = jest.fn().mockResolvedValue({ transcript: "hi", detectedLanguage: "en" });
    const extractFn = jest.fn().mockResolvedValue({
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

    const handler = createReceiveWebhookHandler({ fetchFn, transcribeFn, extractFn });
    const app = createTestApp(handler);
    const server = app.listen(0);

    try {
      const { port } = server.address();

      // First delivery: advances state normally.
      const first = buildAudioWebhookPayload({ from: ownerPhone, messageId, mediaId });
      await fetch(`http://127.0.0.1:${port}/api/webhook/whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(first),
      });
      await Promise.all(handler.pendingWork);
      expect(transcribeFn).toHaveBeenCalledTimes(1);
      expect(extractFn).toHaveBeenCalledTimes(1);

      // Meta retries the identical webhook delivery.
      const replay = buildAudioWebhookPayload({ from: ownerPhone, messageId, mediaId });
      await fetch(`http://127.0.0.1:${port}/api/webhook/whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(replay),
      });
      await Promise.all(handler.pendingWork);

      // Neither media download, transcription, nor extraction happened a
      // second time.
      expect(fetchFn).toHaveBeenCalledTimes(2); // still just the first delivery's two calls
      expect(transcribeFn).toHaveBeenCalledTimes(1); // not called again
      expect(extractFn).toHaveBeenCalledTimes(1); // not called again
    } finally {
      server.close();
    }
  });
});
