import { describe, test, expect, jest, afterEach } from "@jest/globals";
import http from "http";
import { extractFields } from "./extractFields.js";

describe("extractFields", () => {
  test("passes transcript and language through to extractFn and returns its result verbatim", async () => {
    const expectedResult = {
      name: "Ramesh's Homestay",
      type: "homestay",
      capacity: 3,
      priceRangeINR: { min: 800, max: 1500 },
      amenities: ["hot water"],
      meals: [],
      nearestLandmark: "Main Chowk",
      languages: ["hi"],
      seasonalNotes: null,
    };
    const stub = jest.fn().mockResolvedValue(expectedResult);

    const result = await extractFields("Yeh mera ghar hai, teen kamre hain.", "hi", stub);

    expect(stub).toHaveBeenCalledTimes(1);
    expect(stub).toHaveBeenCalledWith("Yeh mera ghar hai, teen kamre hain.", "hi");
    expect(result).toEqual(expectedResult);
  });

  test("works with a synchronous extractFn too (still awaited correctly)", async () => {
    const syncStub = jest.fn(() => ({ name: null, type: null }));

    const result = await extractFields("some transcript", "en", syncStub);

    expect(result).toEqual({ name: null, type: null });
  });

  test("does not itself validate or reshape whatever extractFn returns — even malformed shapes pass through untouched", async () => {
    const malformedStub = jest.fn().mockResolvedValue({ totally: "not the right shape" });

    const result = await extractFields("transcript", "en", malformedStub);

    expect(result).toEqual({ totally: "not the right shape" });
  });

  test("propagates a rejection from extractFn rather than swallowing it", async () => {
    const failingStub = jest.fn().mockRejectedValue(new Error("gemini call failed"));

    await expect(extractFields("transcript", "en", failingStub)).rejects.toThrow("gemini call failed");
  });

  describe("default backend (callExtractionService, no extractFn override)", () => {
    const originalUrl = process.env.EXTRACT_SERVICE_URL;
    let server;

    afterEach(async () => {
      process.env.EXTRACT_SERVICE_URL = originalUrl;
      if (server) {
        await new Promise((resolve) => server.close(resolve));
        server = undefined;
      }
    });

    // Same technique as transcription.test.js: claim a real free port then
    // close it immediately, reliably simulating "ai-service isn't running."
    async function getUnreachableUrl() {
      const probe = http.createServer();
      await new Promise((resolve) => probe.listen(0, resolve));
      const { port } = probe.address();
      await new Promise((resolve) => probe.close(resolve));
      return `http://127.0.0.1:${port}/onboarding/extract`;
    }

    test("with no service reachable, fails with a clear, actionable error rather than silently or with garbage", async () => {
      process.env.EXTRACT_SERVICE_URL = await getUnreachableUrl();

      await expect(extractFields("transcript", "en")).rejects.toThrow(
        /could not reach the extraction service.*is ai-service running/i
      );
    });

    test("surfaces a clear error when the service responds with a non-2xx status", async () => {
      server = http.createServer((req, res) => {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("gemini quota exceeded");
      });
      await new Promise((resolve) => server.listen(0, resolve));
      process.env.EXTRACT_SERVICE_URL = `http://127.0.0.1:${server.address().port}/onboarding/extract`;

      await expect(extractFields("transcript", "en")).rejects.toThrow(/returned 500.*gemini quota exceeded/i);
    });

    // Genuine end-to-end proof of the Node-side HTTP wiring: a real JSON
    // POST with { transcript, language }, and the service's JSON response
    // handed back untouched. Doesn't need a real Gemini call to verify
    // this — only the HTTP contract.
    test("correctly POSTs { transcript, language } as JSON and returns a real service's JSON response", async () => {
      let receivedContentType;
      let receivedBody = "";

      server = http.createServer((req, res) => {
        receivedContentType = req.headers["content-type"];
        req.on("data", (chunk) => {
          receivedBody += chunk;
        });
        req.on("end", () => {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ name: "Test Homestay", type: "homestay" }));
        });
      });
      await new Promise((resolve) => server.listen(0, resolve));
      process.env.EXTRACT_SERVICE_URL = `http://127.0.0.1:${server.address().port}/onboarding/extract`;

      const result = await extractFields("Teen kamre hain, geyser hai.", "hi");

      expect(result).toEqual({ name: "Test Homestay", type: "homestay" });
      expect(receivedContentType).toBe("application/json");
      expect(JSON.parse(receivedBody)).toEqual({ transcript: "Teen kamre hain, geyser hai.", language: "hi" });
    });
  });
});
