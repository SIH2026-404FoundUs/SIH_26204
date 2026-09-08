import { describe, test, expect, jest, beforeEach, afterEach } from "@jest/globals";
import http from "http";
import { sendWhatsAppMessage } from "./sendMessage.js";

describe("sendWhatsAppMessage", () => {
  test("passes to/text through to sendFn and returns its result verbatim", async () => {
    const stub = jest.fn().mockResolvedValue({ messages: [{ id: "wamid.sent-1" }] });

    const result = await sendWhatsAppMessage("919876543210", "What is the name of your property?", stub);

    expect(stub).toHaveBeenCalledTimes(1);
    expect(stub).toHaveBeenCalledWith("919876543210", "What is the name of your property?");
    expect(result).toEqual({ messages: [{ id: "wamid.sent-1" }] });
  });

  test("propagates a rejection from sendFn rather than swallowing it", async () => {
    const failingStub = jest.fn().mockRejectedValue(new Error("Meta returned 400"));

    await expect(sendWhatsAppMessage("919876543210", "hi", failingStub)).rejects.toThrow("Meta returned 400");
  });

  describe("default backend (sendViaGraphAPI, no sendFn override)", () => {
    const originalToken = process.env.WHATSAPP_TOKEN;
    const originalPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    let server;

    beforeEach(() => {
      process.env.WHATSAPP_TOKEN = "test-whatsapp-token";
      process.env.WHATSAPP_PHONE_NUMBER_ID = "test-phone-number-id";
    });

    afterEach(async () => {
      process.env.WHATSAPP_TOKEN = originalToken;
      process.env.WHATSAPP_PHONE_NUMBER_ID = originalPhoneNumberId;
      if (server) {
        await new Promise((resolve) => server.close(resolve));
        server = undefined;
      }
    });

    test("WHATSAPP_TOKEN missing/unset: fails loudly before making any network call", async () => {
      delete process.env.WHATSAPP_TOKEN;
      const originalFetch = global.fetch;
      global.fetch = jest.fn();

      try {
        await expect(sendWhatsAppMessage("919876543210", "hi")).rejects.toThrow(/WHATSAPP_TOKEN is not set/i);
        expect(global.fetch).not.toHaveBeenCalled();
      } finally {
        global.fetch = originalFetch;
      }
    });

    test("WHATSAPP_PHONE_NUMBER_ID missing/unset: fails loudly before making any network call", async () => {
      delete process.env.WHATSAPP_PHONE_NUMBER_ID;
      const originalFetch = global.fetch;
      global.fetch = jest.fn();

      try {
        await expect(sendWhatsAppMessage("919876543210", "hi")).rejects.toThrow(
          /WHATSAPP_PHONE_NUMBER_ID is not set/i
        );
        expect(global.fetch).not.toHaveBeenCalled();
      } finally {
        global.fetch = originalFetch;
      }
    });

    test("surfaces a clear error when the send endpoint responds with a non-2xx status", async () => {
      server = http.createServer((req, res) => {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: { message: "Recipient phone number not in allowed list" } }));
      });
      await new Promise((resolve) => server.listen(0, resolve));

      const originalFetch = global.fetch;
      global.fetch = (url, opts) => originalFetch(url.replace(/^https:\/\/graph\.facebook\.com/, `http://127.0.0.1:${server.address().port}`), opts);

      try {
        await expect(sendWhatsAppMessage("919876543210", "hi")).rejects.toThrow(
          /returned 400.*Recipient phone number not in allowed list/i
        );
      } finally {
        global.fetch = originalFetch;
      }
    });

    // Genuine end-to-end proof of the real HTTP wiring: correct URL shape
    // (phone_number_id in the path), auth header, and exact JSON body
    // shape -- the same verification rigor mediaDownload.test.js applies
    // to the two-step media fetch.
    test("correctly POSTs the verified Meta request shape (URL, auth header, JSON body)", async () => {
      let receivedUrl;
      let receivedHeaders;
      let receivedBody = "";

      server = http.createServer((req, res) => {
        receivedUrl = req.url;
        receivedHeaders = req.headers;
        req.on("data", (chunk) => {
          receivedBody += chunk;
        });
        req.on("end", () => {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ messaging_product: "whatsapp", messages: [{ id: "wamid.real-1" }] }));
        });
      });
      await new Promise((resolve) => server.listen(0, resolve));

      const originalFetch = global.fetch;
      global.fetch = (url, opts) => originalFetch(url.replace(/^https:\/\/graph\.facebook\.com/, `http://127.0.0.1:${server.address().port}`), opts);

      try {
        const result = await sendWhatsAppMessage("919876543210", "What is the name of your property?");

        expect(receivedUrl).toBe("/v21.0/test-phone-number-id/messages");
        expect(receivedHeaders.authorization).toBe("Bearer test-whatsapp-token");
        expect(receivedHeaders["content-type"]).toBe("application/json");
        expect(JSON.parse(receivedBody)).toEqual({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: "919876543210",
          type: "text",
          text: { body: "What is the name of your property?" },
        });
        expect(result).toEqual({ messaging_product: "whatsapp", messages: [{ id: "wamid.real-1" }] });
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});
