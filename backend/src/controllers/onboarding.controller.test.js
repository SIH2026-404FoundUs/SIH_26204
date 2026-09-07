import { describe, test, expect, beforeAll, afterAll, afterEach, jest } from "@jest/globals";
import express from "express";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Business from "../models/business.model.js";
import { uploadAudioMiddleware, createOnboardingUploadHandler } from "./onboarding.controller.js";

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

// Builds a standalone test app with the upload route mounted directly,
// injecting a stub transcribeFn the same way eligibility.test.js injects
// pressureFn — never depends on a real transcription backend.
function createTestApp(transcribeFn) {
  const app = express();
  app.use(express.json());
  app.post("/upload", uploadAudioMiddleware, createOnboardingUploadHandler({ transcribeFn }));
  return app;
}

async function postUpload(server, { destId, ownerPhone, extractedFields, messageId, audioBytes = "fake audio" }) {
  const { port } = server.address();
  const form = new FormData();
  form.append("audio", new Blob([Buffer.from(audioBytes)], { type: "audio/ogg" }), "voice.ogg");
  if (destId !== undefined) form.append("destId", destId);
  if (ownerPhone !== undefined) form.append("ownerPhone", ownerPhone);
  if (extractedFields !== undefined) form.append("extractedFields", JSON.stringify(extractedFields));
  if (messageId !== undefined) form.append("messageId", messageId);

  const response = await fetch(`http://127.0.0.1:${port}/upload`, { method: "POST", body: form });
  const data = await response.json();
  return { status: response.status, data };
}

const validExtraction = () => ({
  name: "Green Valley Homestay",
  type: "homestay",
  capacity: 4,
  priceRangeINR: { min: 1000, max: 2000 },
  amenities: ["hot water"],
  meals: [],
  nearestLandmark: "Main Chowk",
  languages: ["hi"],
  seasonalNotes: null,
});

describe("POST /upload (onboarding internal fallback)", () => {
  test("full successful run: advances a fresh draft through to EXTRACTING", async () => {
    const transcript = "This is Green Valley Homestay near Main Chowk. We have hot water.";
    const stub = jest.fn().mockResolvedValue({ transcript, detectedLanguage: "hi" });
    const app = createTestApp(stub);
    const server = app.listen(0);

    try {
      const { status, data } = await postUpload(server, {
        destId: "shimla",
        ownerPhone: "+919876500001",
        extractedFields: validExtraction(),
        messageId: "upload-success-1",
      });

      expect(status).toBe(200);
      expect(data.onboardingState).toBe("EXTRACTING");
      expect(data.appliedHops).toEqual([
        "AWAITING_CONSENT",
        "AWAITING_VOICE",
        "TRANSCRIBING",
        "EXTRACTING",
      ]);
      expect(data.transcript).toBe(transcript);
      expect(data.detectedLanguage).toBe("hi");
      expect(data.extraction.shapeValid).toBe(true);
      expect(data.extraction.honest).toBe(true);
      expect(data.extraction.failedFields).toEqual([]);

      const saved = await Business.findOne({ _id: data.businessId });
      expect(saved.onboardingState).toBe("EXTRACTING");
      expect(saved.name).toBe("Green Valley Homestay");
      expect(saved.type).toBe("homestay");
      expect(saved.rawTranscript).toBe(transcript);
      expect(saved.transcriptLang).toBe("hi");
      expect(saved.destId).toBe("shimla");
    } finally {
      server.close();
    }
  });

  test("rejected extraction (invented amenity) does NOT advance the draft past TRANSCRIBING", async () => {
    const transcript = "This is Green Valley Homestay near Main Chowk.";
    const stub = jest.fn().mockResolvedValue({ transcript, detectedLanguage: "hi" });
    const app = createTestApp(stub);
    const server = app.listen(0);

    try {
      const { status, data } = await postUpload(server, {
        destId: "shimla",
        ownerPhone: "+919876500002",
        extractedFields: { ...validExtraction(), amenities: ["swimming pool"] }, // never mentioned
        messageId: "upload-rejected-1",
      });

      expect(status).toBe(422);
      expect(data.onboardingState).toBe("TRANSCRIBING"); // NOT EXTRACTING
      expect(data.appliedHops).toEqual(["AWAITING_CONSENT", "AWAITING_VOICE", "TRANSCRIBING"]);
      expect(data.extraction.honest).toBe(false);
      expect(data.extraction.failedFields).toContainEqual({ field: "amenities[0]", value: "swimming pool" });

      const saved = await Business.findOne({ _id: data.businessId });
      expect(saved.onboardingState).toBe("TRANSCRIBING");
      expect(saved.rawTranscript).toBe(transcript); // transcription itself did genuinely succeed
      expect(saved.name).toBeUndefined(); // rejected fields must not be persisted
      expect(saved.type).toBeUndefined();
    } finally {
      server.close();
    }
  });

  test("a shape-invalid extraction is also rejected without advancing past TRANSCRIBING", async () => {
    const stub = jest.fn().mockResolvedValue({ transcript: "hello", detectedLanguage: "en" });
    const app = createTestApp(stub);
    const server = app.listen(0);

    try {
      const { status, data } = await postUpload(server, {
        destId: "shimla",
        ownerPhone: "+919876500003",
        extractedFields: { ...validExtraction(), type: "hotel" }, // not in the enum
        messageId: "upload-badshape-1",
      });

      expect(status).toBe(422);
      expect(data.onboardingState).toBe("TRANSCRIBING");
      expect(data.extraction.shapeValid).toBe(false);
      expect(data.extraction.shapeErrors).toContain('invalid field: "type"');
    } finally {
      server.close();
    }
  });

  test("the injected transcribeFn is actually used, with the uploaded buffer", async () => {
    const stub = jest.fn().mockResolvedValue({ transcript: "hi", detectedLanguage: "en" });
    const app = createTestApp(stub);
    const server = app.listen(0);

    try {
      await postUpload(server, {
        destId: "shimla",
        ownerPhone: "+919876500004",
        extractedFields: { ...validExtraction(), name: null, amenities: [], nearestLandmark: null, seasonalNotes: null },
        messageId: "upload-injection-1",
        audioBytes: "distinctive-audio-payload",
      });

      expect(stub).toHaveBeenCalledTimes(1);
      const receivedBuffer = stub.mock.calls[0][0];
      expect(Buffer.isBuffer(receivedBuffer)).toBe(true);
      expect(receivedBuffer.toString()).toBe("distinctive-audio-payload");
    } finally {
      server.close();
    }
  });

  test("without an injected transcribeFn, the endpoint fails loudly rather than calling a real service", async () => {
    const app = createTestApp(undefined); // no override — must NOT silently succeed
    const server = app.listen(0);

    try {
      const { status, data } = await postUpload(server, {
        destId: "shimla",
        ownerPhone: "+919876500005",
        extractedFields: validExtraction(),
        messageId: "upload-unconfigured-1",
      });

      expect(status).toBe(500);
      expect(data.message).toMatch(/not implemented yet.*wire up faster-whisper/i);

      // And it must not have created/advanced a draft as a side effect.
      const saved = await Business.findOne({ ownerPhone: "+919876500005" });
      expect(saved).toBeNull();
    } finally {
      server.close();
    }
  });

  test("replaying the same messageId does not re-transcribe or re-advance the draft", async () => {
    const stub = jest.fn().mockResolvedValue({
      transcript: "Green Valley Homestay near Main Chowk with hot water.",
      detectedLanguage: "hi",
    });
    const app = createTestApp(stub);
    const server = app.listen(0);

    try {
      const first = await postUpload(server, {
        destId: "shimla",
        ownerPhone: "+919876500006",
        extractedFields: validExtraction(),
        messageId: "upload-replay-1",
      });
      expect(first.status).toBe(200);
      expect(stub).toHaveBeenCalledTimes(1);

      const replay = await postUpload(server, {
        destId: "shimla",
        ownerPhone: "+919876500006",
        extractedFields: validExtraction(),
        messageId: "upload-replay-1", // identical messageId
      });

      expect(replay.data.reason).toBe("duplicate_message");
      expect(replay.data.applied).toBe(false);
      expect(stub).toHaveBeenCalledTimes(1); // NOT called again
    } finally {
      server.close();
    }
  });

  test("rejects with 400 when no audio file is attached", async () => {
    const stub = jest.fn();
    const app = createTestApp(stub);
    const server = app.listen(0);

    try {
      const { port } = server.address();
      const form = new FormData();
      form.append("destId", "shimla");
      form.append("ownerPhone", "+919876500007");
      form.append("extractedFields", JSON.stringify(validExtraction()));

      const response = await fetch(`http://127.0.0.1:${port}/upload`, { method: "POST", body: form });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toMatch(/audio file is required/i);
      expect(stub).not.toHaveBeenCalled();
    } finally {
      server.close();
    }
  });
});
