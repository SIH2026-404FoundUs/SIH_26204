import { describe, test, expect, beforeAll, afterAll, afterEach, jest } from "@jest/globals";
import express from "express";
import http from "http";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Business from "../models/business.model.js";
import { uploadAudioMiddleware, createOnboardingUploadHandler } from "./onboarding.controller.js";

// Same technique as transcription.test.js's getUnreachableUrl(): claim a
// real free port, then close it immediately -- reliably simulating "no
// ai-service is reachable" regardless of whether a real ai-service
// happens to be running on the hardcoded default port (localhost:8000)
// during this test run. Without this, a test relying on transcribeAudio's
// unconfigured default would flake whenever ai-service is actually up.
async function getUnreachableTranscribeUrl() {
  const probe = http.createServer();
  await new Promise((resolve) => probe.listen(0, resolve));
  const { port } = probe.address();
  await new Promise((resolve) => probe.close(resolve));
  return `http://127.0.0.1:${port}/onboarding/transcribe`;
}

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
// injecting stub transcribeFn/extractFn the same way eligibility.test.js
// injects pressureFn — never depends on a real transcription or
// extraction backend.
function createTestApp(transcribeFn, extractFn) {
  const app = express();
  app.use(express.json());
  app.post("/upload", uploadAudioMiddleware, createOnboardingUploadHandler({ transcribeFn, extractFn }));
  return app;
}

async function postUpload(
  server,
  { destId, ownerPhone, extractedFields, messageId, audioBytes = "fake audio", staffSkills, staffServiceAreaDestIds }
) {
  const { port } = server.address();
  const form = new FormData();
  form.append("audio", new Blob([Buffer.from(audioBytes)], { type: "audio/ogg" }), "voice.ogg");
  if (destId !== undefined) form.append("destId", destId);
  if (ownerPhone !== undefined) form.append("ownerPhone", ownerPhone);
  if (extractedFields !== undefined) form.append("extractedFields", JSON.stringify(extractedFields));
  if (messageId !== undefined) form.append("messageId", messageId);
  if (staffSkills !== undefined) form.append("staff_skills", JSON.stringify(staffSkills));
  if (staffServiceAreaDestIds !== undefined) {
    form.append("staff_serviceAreaDestIds", JSON.stringify(staffServiceAreaDestIds));
  }

  const response = await fetch(`http://127.0.0.1:${port}/upload`, { method: "POST", body: form });
  const data = await response.json();
  return { status: response.status, data };
}

const validGuideExtraction = () => ({
  name: "Raju the Guide",
  type: "guide",
  capacity: 8,
  priceRangeINR: { min: 500, max: 1000 },
  amenities: [],
  meals: [],
  nearestLandmark: "Main Chowk",
  languages: ["en"],
  seasonalNotes: null,
});

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

  test("with no sendMessageFn configured, a draft left with missing required fields produces zero real network calls for the follow-up send", async () => {
    // Proves the no-op default actually holds -- not just that the code
    // reads correctly. Deliberately incomplete extraction (capacity/
    // priceRangeINR/nearestLandmark/destId all still missing after this
    // save) is exactly the scenario where a real send WOULD be attempted
    // if createOnboardingUploadHandler's own sendMessageFn default were
    // the real send (or undefined, falling through to processInboundAudio's
    // real default) instead of the no-op.
    const transcript = "This is Bare Bones Homestay. No other details given.";
    const transcribeStub = jest.fn().mockResolvedValue({ transcript, detectedLanguage: "en" });
    const incompleteExtraction = {
      name: "Bare Bones Homestay",
      type: "homestay",
      capacity: null,
      priceRangeINR: null,
      amenities: [],
      meals: [],
      nearestLandmark: null,
      languages: [],
      seasonalNotes: null,
    };

    // No sendMessageFn passed to createTestApp/createOnboardingUploadHandler
    // at all -- exercising the real, unconfigured default path.
    const app = createTestApp(transcribeStub);
    const server = app.listen(0);

    const originalFetch = global.fetch;
    const fetchSpy = jest.fn((...args) => originalFetch(...args));
    global.fetch = fetchSpy;

    try {
      const { status, data } = await postUpload(server, {
        destId: "shimla",
        ownerPhone: "+919876500098",
        extractedFields: incompleteExtraction,
        messageId: "upload-noop-send-1",
      });

      expect(status).toBe(200);
      expect(data.onboardingState).toBe("EXTRACTING");

      // Sanity: the draft really is left with missing required fields --
      // this is the scenario where a real send would fire without the
      // no-op default actually applying.
      const saved = await Business.findOne({ _id: data.businessId });
      expect(saved.capacity).toBeUndefined();
      expect(saved.priceRangeINR?.min).toBeUndefined();
      expect(saved.priceRangeINR?.max).toBeUndefined();
      expect(saved.nearestLandmark).toBeUndefined();

      // The real proof: no fetch call this request made (including the
      // test client's own call to the local Express server under test,
      // which the graph.facebook.com filter below excludes) ever reached
      // Meta's Graph API.
      const graphApiCalls = fetchSpy.mock.calls.filter(([url]) => String(url).includes("graph.facebook.com"));
      expect(graphApiCalls).toEqual([]);
    } finally {
      global.fetch = originalFetch;
      server.close();
    }
  });

  test("with no extractedFields supplied at all, a real extraction call fires end-to-end (via the injected extractFn stub)", async () => {
    // The point of this test: with extractedFields genuinely absent from
    // the request, this endpoint now runs "the exact same pipeline
    // downstream of the webhook" for real — transcription AND extraction
    // both actually attempted, not a placeholder standing in for the
    // extraction half. No real Gemini call happens here: extractFn is an
    // injected stub, same DI pattern as transcribeFn.
    const transcript = "This is Green Valley Homestay near Main Chowk. We have hot water.";
    const transcribeStub = jest.fn().mockResolvedValue({ transcript, detectedLanguage: "hi" });
    const extractStub = jest.fn().mockResolvedValue(validExtraction());
    const app = createTestApp(transcribeStub, extractStub);
    const server = app.listen(0);

    try {
      const { status, data } = await postUpload(server, {
        destId: "shimla",
        ownerPhone: "+919876500099",
        // extractedFields intentionally NOT included in the request at all.
        messageId: "upload-real-extraction-1",
      });

      expect(status).toBe(200);
      expect(extractStub).toHaveBeenCalledTimes(1);
      // Brand-new draft (bootstrap path) -- no pending question to be a
      // reply to, so pendingField is null.
      expect(extractStub).toHaveBeenCalledWith(transcript, "hi", null);
      expect(data.onboardingState).toBe("EXTRACTING");
      expect(data.extraction.attempted).toBe(true);
      expect(data.extraction.shapeValid).toBe(true);
      expect(data.extraction.honest).toBe(true);

      const saved = await Business.findOne({ _id: data.businessId });
      expect(saved.name).toBe("Green Valley Homestay");
      expect(saved.type).toBe("homestay");
      expect(saved.rawTranscript).toBe(transcript);
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

  test("without an injected transcribeFn, the endpoint fails loudly rather than silently succeeding", async () => {
    const originalUrl = process.env.TRANSCRIBE_SERVICE_URL;
    // Force the real, unconfigured transcribeAudio default to hit a
    // guaranteed-unreachable port, not whatever localhost:8000 happens to
    // be doing on this machine right now (it could be a real ai-service,
    // making this test flake rather than exercise the failure path).
    process.env.TRANSCRIBE_SERVICE_URL = await getUnreachableTranscribeUrl();

    const app = createTestApp(undefined); // no override — falls through to the real HTTP backend
    const server = app.listen(0);

    try {
      const { status, data } = await postUpload(server, {
        destId: "shimla",
        ownerPhone: "+919876500005",
        extractedFields: validExtraction(),
        messageId: "upload-unconfigured-1",
      });

      // No ai-service reachable at the URL this test forced, so the real
      // transcribeFn correctly fails loudly rather than silently
      // succeeding or returning garbage — it just doesn't happen to be
      // "not implemented" anymore now that the real backend exists.
      expect(status).toBe(500);
      expect(data.message).toMatch(/could not reach the transcription service/i);

      // And it must not have created/advanced a draft as a side effect.
      const saved = await Business.findOne({ ownerPhone: "+919876500005" });
      expect(saved).toBeNull();
    } finally {
      server.close();
      process.env.TRANSCRIBE_SERVICE_URL = originalUrl;
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

  test("a guide-type business persists staff_skills/staff_serviceAreaDestIds correctly (Section 1.4)", async () => {
    const transcript = "This is Raju the Guide, based near Main Chowk. I take groups of up to 8 people, and charge 500 to 1000 rupees.";
    const stub = jest.fn().mockResolvedValue({ transcript, detectedLanguage: "en" });
    const app = createTestApp(stub);
    const server = app.listen(0);

    try {
      const { status, data } = await postUpload(server, {
        destId: "shimla",
        ownerPhone: "+919000000011",
        extractedFields: validGuideExtraction(),
        messageId: "upload-guide-1",
        staffSkills: ["trekking", "wildlife"],
        staffServiceAreaDestIds: ["shimla", "manali"],
      });

      expect(status).toBe(200);
      expect(data.onboardingState).toBe("EXTRACTING");
      expect(data.extraction.shapeValid).toBe(true);
      expect(data.extraction.honest).toBe(true);

      const saved = await Business.findOne({ _id: data.businessId });
      expect(saved.type).toBe("guide");
      expect(saved.name).toBe("Raju the Guide");
      expect(saved.capacity).toBe(8);
      expect(saved.staff_skills).toEqual(["trekking", "wildlife"]);
      expect(saved.staff_serviceAreaDestIds).toEqual(["shimla", "manali"]);
    } finally {
      server.close();
    }
  });

  test("staff_skills/staff_serviceAreaDestIds are optional — a guide-type upload without them still succeeds", async () => {
    const transcript = "This is Raju the Guide, based near Main Chowk. I take groups of up to 8 people, and charge 500 to 1000 rupees.";
    const stub = jest.fn().mockResolvedValue({ transcript, detectedLanguage: "en" });
    const app = createTestApp(stub);
    const server = app.listen(0);

    try {
      const { status, data } = await postUpload(server, {
        destId: "shimla",
        ownerPhone: "+919000000012",
        extractedFields: validGuideExtraction(),
        messageId: "upload-guide-2",
        // no staffSkills / staffServiceAreaDestIds supplied
      });

      expect(status).toBe(200);
      const saved = await Business.findOne({ _id: data.businessId });
      expect(saved.staff_skills).toEqual([]); // schema default, untouched
      expect(saved.staff_serviceAreaDestIds).toEqual([]);
    } finally {
      server.close();
    }
  });

  test("staff_skills persist even when the extraction itself is rejected — they're independent of that pipeline", async () => {
    const transcript = "This is Raju the Guide, based near Main Chowk.";
    const stub = jest.fn().mockResolvedValue({ transcript, detectedLanguage: "en" });
    const app = createTestApp(stub);
    const server = app.listen(0);

    try {
      const { status, data } = await postUpload(server, {
        destId: "shimla",
        ownerPhone: "+919000000013",
        extractedFields: { ...validGuideExtraction(), amenities: ["invented amenity never said"] },
        messageId: "upload-guide-3",
        staffSkills: ["rafting"],
        staffServiceAreaDestIds: ["shimla"],
      });

      expect(status).toBe(422); // extraction rejected (honesty failure)
      expect(data.onboardingState).toBe("TRANSCRIBING"); // did not advance to EXTRACTING

      const saved = await Business.findOne({ _id: data.businessId });
      expect(saved.name).toBeUndefined(); // rejected extraction fields not persisted
      expect(saved.staff_skills).toEqual(["rafting"]); // but staff fields still are
      expect(saved.staff_serviceAreaDestIds).toEqual(["shimla"]);
    } finally {
      server.close();
    }
  });

  test("rejects with 400 when staff_skills is not a JSON array of strings", async () => {
    const stub = jest.fn().mockResolvedValue({ transcript: "hi", detectedLanguage: "en" });
    const app = createTestApp(stub);
    const server = app.listen(0);

    try {
      const { port } = server.address();
      const form = new FormData();
      form.append("audio", new Blob([Buffer.from("audio")]), "voice.ogg");
      form.append("destId", "shimla");
      form.append("ownerPhone", "+919000000014");
      form.append("extractedFields", JSON.stringify(validGuideExtraction()));
      form.append("staff_skills", JSON.stringify({ not: "an array" }));

      const response = await fetch(`http://127.0.0.1:${port}/upload`, { method: "POST", body: form });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toMatch(/staff_skills must be an array of strings/i);
      expect(stub).not.toHaveBeenCalled();
    } finally {
      server.close();
    }
  });
});
