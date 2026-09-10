import { describe, test, expect, jest, beforeAll, afterAll, beforeEach, afterEach } from "@jest/globals";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Business from "../../models/business.model.js";
import { processInboundImage, MIN_PHOTOS, MAX_PHOTOS } from "./processInboundImage.js";

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
  // fetchWhatsAppMedia (called internally by processInboundImage) checks
  // WHATSAPP_TOKEN unconditionally before using the injected fetchFn.
  process.env.WHATSAPP_TOKEN = "test-whatsapp-token";
});

afterEach(async () => {
  process.env.WHATSAPP_TOKEN = originalWhatsAppToken;
  await Business.deleteMany({});
});

// fetchWhatsAppMedia does a real two-step flow: media_id -> {url} JSON,
// then GET that url -> raw bytes. This stub matches that exact shape,
// same technique as mediaDownload.test.js/whatsappWebhook.controller.test.js.
function makeTwoStepFetchFn(imageBytes) {
  return jest.fn(async (url) => {
    if (url.includes("graph.facebook.com")) {
      return { ok: true, status: 200, json: async () => ({ url: "https://lookaside.fbsbx.com/whatsapp_media/img" }) };
    }
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () => imageBytes.buffer.slice(imageBytes.byteOffset, imageBytes.byteOffset + imageBytes.byteLength),
    };
  });
}

const stubUpload = jest.fn().mockResolvedValue("https://res.cloudinary.com/test/photo.jpg");

describe("processInboundImage", () => {
  test("no draft exists yet for this ownerPhone: fails clearly, does not attempt download/upload", async () => {
    const fetchFn = jest.fn();
    const uploadFn = jest.fn();

    const result = await processInboundImage({
      ownerPhone: "919000000050",
      mediaId: "media_1",
      fetchFn,
      uploadFn,
    });

    expect(result).toEqual({ applied: false, reason: "no_draft", businessId: null });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(uploadFn).not.toHaveBeenCalled();
  });

  test("a single photo appends to Business.photos[] and is not yet 'satisfied' (below MIN_PHOTOS)", async () => {
    await Business.create({
      _id: "biz_test_photo_1",
      destId: "shimla",
      ownerPhone: "919000000051",
      onboardingState: "EXTRACTING",
    });

    const result = await processInboundImage({
      ownerPhone: "919000000051",
      mediaId: "media_1",
      fetchFn: makeTwoStepFetchFn(Buffer.from("fake image bytes")),
      uploadFn: stubUpload,
    });

    expect(result.applied).toBe(true);
    expect(result.photoCount).toBe(1);
    expect(result.photosSatisfied).toBe(false);
    expect(result.onboardingState).toBe("EXTRACTING");

    const saved = await Business.findOne({ _id: "biz_test_photo_1" });
    expect(saved.photos).toEqual(["https://res.cloudinary.com/test/photo.jpg"]);
    expect(saved.onboardingState).toBe("EXTRACTING"); // remains before AWAITING_DATES
  });

  test("1 photo -> remains before AWAITING_DATES, no dates prompt sent", async () => {
    await Business.create({
      _id: "biz_test_photo_1_photo",
      destId: "shimla",
      ownerPhone: "919000000061",
      onboardingState: "EXTRACTING",
      photos: [],
    });

    const sendMessageFn = jest.fn();
    const result = await processInboundImage({
      ownerPhone: "919000000061",
      mediaId: "media_p1",
      fetchFn: makeTwoStepFetchFn(Buffer.from("fake image bytes")),
      uploadFn: stubUpload,
      sendMessageFn,
    });

    expect(result.applied).toBe(true);
    expect(result.photoCount).toBe(1);
    expect(result.photosSatisfied).toBe(false);
    expect(result.onboardingState).toBe("EXTRACTING");
    expect(sendMessageFn).not.toHaveBeenCalled();

    const saved = await Business.findOne({ _id: "biz_test_photo_1_photo" });
    expect(saved.onboardingState).toBe("EXTRACTING");
  });

  test("2 photos -> remains before AWAITING_DATES, no dates prompt sent", async () => {
    await Business.create({
      _id: "biz_test_photo_2_photos",
      destId: "shimla",
      ownerPhone: "919000000062",
      onboardingState: "FOLLOWUP",
      photos: ["https://res.cloudinary.com/p0.jpg"],
    });

    const sendMessageFn = jest.fn();
    const result = await processInboundImage({
      ownerPhone: "919000000062",
      mediaId: "media_p2",
      fetchFn: makeTwoStepFetchFn(Buffer.from("fake image bytes")),
      uploadFn: stubUpload,
      sendMessageFn,
    });

    expect(result.applied).toBe(true);
    expect(result.photoCount).toBe(2);
    expect(result.photosSatisfied).toBe(false);
    expect(result.onboardingState).toBe("FOLLOWUP");
    expect(sendMessageFn).not.toHaveBeenCalled();

    const saved = await Business.findOne({ _id: "biz_test_photo_2_photos" });
    expect(saved.onboardingState).toBe("FOLLOWUP");
  });

  test(`3rd photo -> transitions to AWAITING_DATES and sends the prompt`, async () => {
    await Business.create({
      _id: "biz_test_photo_2",
      destId: "shimla",
      ownerPhone: "919000000052",
      onboardingState: "FOLLOWUP",
      photos: Array.from({ length: MIN_PHOTOS - 1 }, (_, i) => `https://res.cloudinary.com/existing-${i}.jpg`),
    });

    const sendMessageFn = jest.fn();
    const result = await processInboundImage({
      ownerPhone: "919000000052",
      mediaId: "media_last",
      fetchFn: makeTwoStepFetchFn(Buffer.from("fake image bytes")),
      uploadFn: stubUpload,
      sendMessageFn,
    });

    expect(result.applied).toBe(true);
    expect(result.photoCount).toBe(MIN_PHOTOS);
    expect(result.photosSatisfied).toBe(true);
    expect(result.onboardingState).toBe("AWAITING_DATES");

    const saved = await Business.findOne({ _id: "biz_test_photo_2" });
    expect(saved.onboardingState).toBe("AWAITING_DATES");
    expect(sendMessageFn).toHaveBeenCalledTimes(1);
    expect(sendMessageFn).toHaveBeenCalledWith(
      "919000000052",
      expect.stringContaining("dates your property will be open")
    );
  });

  test("4th and 5th photo -> remains AWAITING_DATES, does not resend prompt", async () => {
    await Business.create({
      _id: "biz_test_photo_4_and_5",
      destId: "shimla",
      ownerPhone: "919000000064",
      onboardingState: "AWAITING_DATES",
      photos: [
        "https://res.cloudinary.com/p1.jpg",
        "https://res.cloudinary.com/p2.jpg",
        "https://res.cloudinary.com/p3.jpg",
      ],
    });

    const sendMessageFn = jest.fn();
    // 4th photo
    const result4 = await processInboundImage({
      ownerPhone: "919000000064",
      mediaId: "media_p4",
      fetchFn: makeTwoStepFetchFn(Buffer.from("fake image bytes")),
      uploadFn: stubUpload,
      sendMessageFn,
    });

    expect(result4.applied).toBe(true);
    expect(result4.photoCount).toBe(4);
    expect(result4.photosSatisfied).toBe(true);
    expect(result4.onboardingState).toBe("AWAITING_DATES");
    expect(sendMessageFn).not.toHaveBeenCalled();

    // 5th photo
    const result5 = await processInboundImage({
      ownerPhone: "919000000064",
      mediaId: "media_p5",
      fetchFn: makeTwoStepFetchFn(Buffer.from("fake image bytes")),
      uploadFn: stubUpload,
      sendMessageFn,
    });

    expect(result5.applied).toBe(true);
    expect(result5.photoCount).toBe(5);
    expect(result5.photosSatisfied).toBe(true);
    expect(result5.onboardingState).toBe("AWAITING_DATES");
    expect(sendMessageFn).not.toHaveBeenCalled();

    const saved = await Business.findOne({ _id: "biz_test_photo_4_and_5" });
    expect(saved.photos.length).toBe(5);
    expect(saved.onboardingState).toBe("AWAITING_DATES");
  });

  test("fewer than MIN_PHOTOS waits for more -- does not reject, just reports not-yet-satisfied", async () => {
    await Business.create({
      _id: "biz_test_photo_3",
      destId: "shimla",
      ownerPhone: "919000000053",
      onboardingState: "EXTRACTING",
      photos: ["https://res.cloudinary.com/existing-0.jpg"],
    });

    const result = await processInboundImage({
      ownerPhone: "919000000053",
      mediaId: "media_2",
      fetchFn: makeTwoStepFetchFn(Buffer.from("fake image bytes")),
      uploadFn: stubUpload,
    });

    expect(result.applied).toBe(true);
    expect(result.photoCount).toBe(2);
    expect(result.photosSatisfied).toBe(false);
  });

  test(`6th photo: at MAX_PHOTOS (${MAX_PHOTOS}), a further image is declined -- does not upload or grow the array unbounded`, async () => {
    await Business.create({
      _id: "biz_test_photo_max",
      destId: "shimla",
      ownerPhone: "919000000054",
      onboardingState: "AWAITING_DATES",
      photos: Array.from({ length: MAX_PHOTOS }, (_, i) => `https://res.cloudinary.com/existing-${i}.jpg`),
    });

    const fetchFn = jest.fn();
    const uploadFn = jest.fn();

    const result = await processInboundImage({
      ownerPhone: "919000000054",
      mediaId: "media_extra",
      fetchFn,
      uploadFn,
    });

    expect(result).toEqual({
      applied: false,
      reason: "max_photos_reached",
      businessId: "biz_test_photo_max",
      photoCount: MAX_PHOTOS,
    });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(uploadFn).not.toHaveBeenCalled();

    const saved = await Business.findOne({ _id: "biz_test_photo_max" });
    expect(saved.photos.length).toBe(MAX_PHOTOS);
    expect(saved.onboardingState).toBe("AWAITING_DATES");
  });

  test("early photo before MIN_PHOTOS leaves onboardingState untouched", async () => {
    await Business.create({
      _id: "biz_test_photo_early_state",
      destId: "shimla",
      ownerPhone: "919000000055",
      onboardingState: "TRANSCRIBING",
    });

    const result = await processInboundImage({
      ownerPhone: "919000000055",
      mediaId: "media_1",
      fetchFn: makeTwoStepFetchFn(Buffer.from("fake image bytes")),
      uploadFn: stubUpload,
    });

    expect(result.applied).toBe(true);
    const saved = await Business.findOne({ _id: "biz_test_photo_early_state" });
    expect(saved.onboardingState).toBe("TRANSCRIBING"); // untouched -- under 3 photos
    expect(saved.photos.length).toBe(1);
  });

  test("calls fetchWhatsAppMedia (via fetchFn, both steps with auth) and uploadPhotoToCloudinary (via uploadFn) with the real downloaded bytes", async () => {
    await Business.create({
      _id: "biz_test_photo_args",
      destId: "shimla",
      ownerPhone: "919000000056",
      onboardingState: "EXTRACTING",
    });

    const imageBuffer = Buffer.from("distinctive-image-bytes");
    let metadataHeaders;
    let bytesHeaders;
    const fetchFn = jest.fn(async (url, options) => {
      if (url === "https://graph.facebook.com/v21.0/media_xyz") {
        metadataHeaders = options?.headers;
        return { ok: true, status: 200, json: async () => ({ url: "https://lookaside.fbsbx.com/whatsapp_media/img" }) };
      }
      bytesHeaders = options?.headers;
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => imageBuffer.buffer.slice(imageBuffer.byteOffset, imageBuffer.byteOffset + imageBuffer.byteLength),
      };
    });
    const uploadFn = jest.fn().mockResolvedValue("https://res.cloudinary.com/test/args.jpg");

    const result = await processInboundImage({
      ownerPhone: "919000000056",
      mediaId: "media_xyz",
      fetchFn,
      uploadFn,
    });

    expect(result.applied).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(metadataHeaders).toMatchObject({ Authorization: expect.stringContaining("Bearer ") });
    expect(bytesHeaders).toMatchObject({ Authorization: expect.stringContaining("Bearer ") });
    expect(uploadFn).toHaveBeenCalledTimes(1);
    expect(Buffer.isBuffer(uploadFn.mock.calls[0][0])).toBe(true);
    expect(uploadFn.mock.calls[0][0]).toEqual(imageBuffer);
  });

  test("concurrent arrival of 4 photos from AWAITING_PHOTOS: transitions to AWAITING_DATES, photosSatisfied is true once >= 3, and dates prompt sent exactly once", async () => {
    await Business.create({
      _id: "biz_test_concurrent_photos",
      destId: "shimla",
      ownerPhone: "919000000070",
      onboardingState: "AWAITING_PHOTOS",
      photos: [],
    });

    const sendMessageFn = jest.fn();
    // Simulate concurrent uploads with slight delays to mimic real async I/O
    let uploadCount = 0;
    const concurrentUploadFn = jest.fn(async () => {
      uploadCount++;
      const id = uploadCount;
      // Slight delay to ensure interleaving
      await new Promise((resolve) => setTimeout(resolve, 10));
      return `https://res.cloudinary.com/test/concurrent_${id}.jpg`;
    });

    const results = await Promise.all([
      processInboundImage({
        ownerPhone: "919000000070",
        mediaId: "m1",
        fetchFn: makeTwoStepFetchFn(Buffer.from("img1")),
        uploadFn: concurrentUploadFn,
        sendMessageFn,
      }),
      processInboundImage({
        ownerPhone: "919000000070",
        mediaId: "m2",
        fetchFn: makeTwoStepFetchFn(Buffer.from("img2")),
        uploadFn: concurrentUploadFn,
        sendMessageFn,
      }),
      processInboundImage({
        ownerPhone: "919000000070",
        mediaId: "m3",
        fetchFn: makeTwoStepFetchFn(Buffer.from("img3")),
        uploadFn: concurrentUploadFn,
        sendMessageFn,
      }),
      processInboundImage({
        ownerPhone: "919000000070",
        mediaId: "m4",
        fetchFn: makeTwoStepFetchFn(Buffer.from("img4")),
        uploadFn: concurrentUploadFn,
        sendMessageFn,
      }),
    ]);

    // All 4 applied successfully
    expect(results.every((r) => r.applied)).toBe(true);

    const saved = await Business.findOne({ _id: "biz_test_concurrent_photos" });
    expect(saved.photos.length).toBe(4);
    expect(saved.onboardingState).toBe("AWAITING_DATES");

    // The availability date prompt must be sent exactly once despite concurrent workers
    expect(sendMessageFn).toHaveBeenCalledTimes(1);
    expect(sendMessageFn).toHaveBeenCalledWith(
      "919000000070",
      expect.stringContaining("dates your property will be open")
    );

    // Any result whose post-update photoCount reached >= 3 must report photosSatisfied: true and AWAITING_DATES
    const satisfiedResults = results.filter((r) => r.photoCount >= MIN_PHOTOS);
    expect(satisfiedResults.length).toBeGreaterThanOrEqual(2);
    for (const r of satisfiedResults) {
      expect(r.photosSatisfied).toBe(true);
      expect(r.onboardingState).toBe("AWAITING_DATES");
    }
  });

  test("when business is in DRAFT_CONFIRM, an incoming photo does not revert state back to AWAITING_DATES", async () => {
    await Business.create({
      _id: "biz_test_draft_confirm_no_revert",
      destId: "shimla",
      ownerPhone: "919000000071",
      onboardingState: "DRAFT_CONFIRM",
      photos: [
        "https://res.cloudinary.com/p1.jpg",
        "https://res.cloudinary.com/p2.jpg",
        "https://res.cloudinary.com/p3.jpg",
      ],
    });

    const sendMessageFn = jest.fn();
    const result = await processInboundImage({
      ownerPhone: "919000000071",
      mediaId: "m_extra",
      fetchFn: makeTwoStepFetchFn(Buffer.from("img_extra")),
      uploadFn: stubUpload,
      sendMessageFn,
    });

    expect(result.applied).toBe(true);
    expect(result.photoCount).toBe(4);
    expect(result.photosSatisfied).toBe(true);
    expect(result.onboardingState).toBe("DRAFT_CONFIRM");
    expect(sendMessageFn).not.toHaveBeenCalled();

    const saved = await Business.findOne({ _id: "biz_test_draft_confirm_no_revert" });
    expect(saved.onboardingState).toBe("DRAFT_CONFIRM");
  });
});

