import { describe, test, expect, jest, afterEach } from "@jest/globals";
import http from "http";
import { transcribeAudio } from "./transcription.js";

describe("transcribeAudio", () => {
  test("passes the buffer through to transcribeFn and returns its result verbatim", async () => {
    const audioBuffer = Buffer.from("fake audio bytes");
    const expectedResult = { transcript: "Yeh mera ghar hai, teen kamre hain.", detectedLanguage: "hi" };
    const stub = jest.fn().mockResolvedValue(expectedResult);

    const result = await transcribeAudio(audioBuffer, stub);

    expect(stub).toHaveBeenCalledTimes(1);
    expect(stub).toHaveBeenCalledWith(audioBuffer);
    expect(result).toEqual(expectedResult);
  });

  test("returns the { transcript, detectedLanguage } shape untouched", async () => {
    const stub = jest.fn().mockResolvedValue({
      transcript: "We have three rooms available near the market.",
      detectedLanguage: "en",
    });

    const result = await transcribeAudio(Buffer.from("audio"), stub);

    expect(result).toEqual({
      transcript: "We have three rooms available near the market.",
      detectedLanguage: "en",
    });
    expect(typeof result.transcript).toBe("string");
    expect(typeof result.detectedLanguage).toBe("string");
  });

  test("works with a synchronous transcribeFn too (still awaited correctly)", async () => {
    const syncStub = jest.fn(() => ({ transcript: "sync result", detectedLanguage: "en" }));

    const result = await transcribeAudio(Buffer.from("audio"), syncStub);

    expect(result).toEqual({ transcript: "sync result", detectedLanguage: "en" });
  });

  test("does not mutate or wrap the audioBuffer before handing it to transcribeFn", async () => {
    const audioBuffer = Buffer.from([1, 2, 3, 4]);
    let receivedBuffer;
    const stub = jest.fn(async (buf) => {
      receivedBuffer = buf;
      return { transcript: "x", detectedLanguage: "en" };
    });

    await transcribeAudio(audioBuffer, stub);

    expect(receivedBuffer).toBe(audioBuffer);
  });

  test("propagates a rejection from transcribeFn rather than swallowing it", async () => {
    const failingStub = jest.fn().mockRejectedValue(new Error("whisper crashed"));

    await expect(transcribeAudio(Buffer.from("audio"), failingStub)).rejects.toThrow("whisper crashed");
  });

  describe("default backend (callWhisperService, no transcribeFn override)", () => {
    const originalUrl = process.env.TRANSCRIBE_SERVICE_URL;
    let server;

    afterEach(async () => {
      process.env.TRANSCRIBE_SERVICE_URL = originalUrl;
      if (server) {
        await new Promise((resolve) => server.close(resolve));
        server = undefined;
      }
    });

    // Opens a real server to claim a genuinely free port, then closes it
    // immediately — the returned port is guaranteed to refuse connections
    // right after, reliably simulating "ai-service isn't running" without
    // depending on a hardcoded port number's behavior across platforms.
    async function getUnreachableUrl() {
      const probe = http.createServer();
      await new Promise((resolve) => probe.listen(0, resolve));
      const { port } = probe.address();
      await new Promise((resolve) => probe.close(resolve));
      return `http://127.0.0.1:${port}/onboarding/transcribe`;
    }

    test("with no service reachable, fails with a clear, actionable error rather than silently or with garbage", async () => {
      process.env.TRANSCRIBE_SERVICE_URL = await getUnreachableUrl();

      await expect(transcribeAudio(Buffer.from("audio"))).rejects.toThrow(
        /could not reach the transcription service.*is ai-service running/i
      );
    });

    test("explicitly passing undefined for transcribeFn also falls back to the default", async () => {
      process.env.TRANSCRIBE_SERVICE_URL = await getUnreachableUrl();

      await expect(transcribeAudio(Buffer.from("audio"), undefined)).rejects.toThrow(
        /could not reach the transcription service/i
      );
    });

    test("never returns a fabricated result when the service is unreachable — only ever rejects", async () => {
      process.env.TRANSCRIBE_SERVICE_URL = await getUnreachableUrl();

      await expect(transcribeAudio(Buffer.from("audio"))).rejects.toBeInstanceOf(Error);
    });

    test("surfaces a clear error when the service responds with a non-2xx status", async () => {
      server = http.createServer((req, res) => {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("model not loaded");
      });
      await new Promise((resolve) => server.listen(0, resolve));
      process.env.TRANSCRIBE_SERVICE_URL = `http://127.0.0.1:${server.address().port}/onboarding/transcribe`;

      await expect(transcribeAudio(Buffer.from("audio"))).rejects.toThrow(/returned 500.*model not loaded/i);
    });

    test("surfaces a clear error when the service responds with an unexpected shape", async () => {
      server = http.createServer((req, res) => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ oops: "wrong shape" }));
      });
      await new Promise((resolve) => server.listen(0, resolve));
      process.env.TRANSCRIBE_SERVICE_URL = `http://127.0.0.1:${server.address().port}/onboarding/transcribe`;

      await expect(transcribeAudio(Buffer.from("audio"))).rejects.toThrow(/unexpected shape/i);
    });

    // Genuine end-to-end proof the Node-side wiring is correct: a real HTTP
    // POST with the audio as multipart/form-data under field "audio" (what
    // ai-service/app/onboarding/transcribe.py's UploadFile parameter
    // expects), and the JSON response correctly mapped onto this module's
    // { transcript, detectedLanguage } contract. Doesn't need the real
    // faster-whisper model or GPU to verify this -- only the HTTP contract.
    test("correctly POSTs multipart audio and parses a real service's JSON response", async () => {
      let receivedContentType;
      let receivedBody = Buffer.alloc(0);

      server = http.createServer((req, res) => {
        receivedContentType = req.headers["content-type"];
        req.on("data", (chunk) => {
          receivedBody = Buffer.concat([receivedBody, chunk]);
        });
        req.on("end", () => {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ transcript: "Teen kamre hain, geyser hai.", detectedLanguage: "hi" }));
        });
      });
      await new Promise((resolve) => server.listen(0, resolve));
      process.env.TRANSCRIBE_SERVICE_URL = `http://127.0.0.1:${server.address().port}/onboarding/transcribe`;

      const result = await transcribeAudio(Buffer.from("distinctive-audio-payload"));

      expect(result).toEqual({ transcript: "Teen kamre hain, geyser hai.", detectedLanguage: "hi" });
      expect(receivedContentType).toMatch(/^multipart\/form-data/);
      expect(receivedBody.toString("latin1")).toContain('name="audio"');
      expect(receivedBody.toString("latin1")).toContain("distinctive-audio-payload");
    });
  });
});
