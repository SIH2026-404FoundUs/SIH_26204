import { describe, test, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { fetchWhatsAppMedia } from "./mediaDownload.js";

const FAKE_TOKEN = "test-whatsapp-token-abc123";
const MEDIA_ID = "media_12345";

function jsonResponse(body, ok = true, status = 200) {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) };
}

function bytesResponse(bytes, ok = true, status = 200) {
  return {
    ok,
    status,
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    text: async () => "",
  };
}

describe("fetchWhatsAppMedia", () => {
  const originalToken = process.env.WHATSAPP_TOKEN;

  beforeEach(() => {
    process.env.WHATSAPP_TOKEN = FAKE_TOKEN;
  });

  afterEach(() => {
    process.env.WHATSAPP_TOKEN = originalToken;
  });

  test("success: two-step flow returns the real bytes, with the auth header present on BOTH calls", async () => {
    const realBytes = new Uint8Array([1, 2, 3, 4, 5]);
    const calls = [];
    const fetchFn = jest.fn(async (url, options) => {
      calls.push({ url, headers: options?.headers });
      if (calls.length === 1) {
        return jsonResponse({ url: "https://lookaside.fbsbx.com/whatsapp_media/short-lived-url" });
      }
      return bytesResponse(realBytes);
    });

    const result = await fetchWhatsAppMedia(MEDIA_ID, fetchFn);

    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result).toEqual(Buffer.from(realBytes));

    // The spec's own explicit warning: the second call needs the auth
    // header too, "easy to miss, breaks silently otherwise" — prove it's
    // actually present on both, not just the first.
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(calls[0].url).toBe(`https://graph.facebook.com/v21.0/${MEDIA_ID}`);
    expect(calls[0].headers).toEqual({ Authorization: `Bearer ${FAKE_TOKEN}` });
    expect(calls[1].url).toBe("https://lookaside.fbsbx.com/whatsapp_media/short-lived-url");
    expect(calls[1].headers).toEqual({ Authorization: `Bearer ${FAKE_TOKEN}` });
  });

  test("first call fails (non-2xx): throws a clear error, second call never attempted", async () => {
    const fetchFn = jest.fn(async () => jsonResponse({ error: "invalid media id" }, false, 404));

    await expect(fetchWhatsAppMedia(MEDIA_ID, fetchFn)).rejects.toThrow(
      /media metadata request for media_12345 returned 404/i
    );
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  test("first call network failure: throws a clear error, second call never attempted", async () => {
    const fetchFn = jest.fn(async () => {
      throw new Error("ECONNREFUSED");
    });

    await expect(fetchWhatsAppMedia(MEDIA_ID, fetchFn)).rejects.toThrow(
      /could not reach the media metadata endpoint/i
    );
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  test('first call succeeds but response has no "url" field: throws a clear error, second call never attempted', async () => {
    const fetchFn = jest.fn(async () => jsonResponse({ mime_type: "audio/ogg", sha256: "abc" }));

    await expect(fetchWhatsAppMedia(MEDIA_ID, fetchFn)).rejects.toThrow(/had no "url" field/i);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  test("second call fails (non-2xx): throws a clear error", async () => {
    let callCount = 0;
    const fetchFn = jest.fn(async () => {
      callCount += 1;
      if (callCount === 1) {
        return jsonResponse({ url: "https://lookaside.fbsbx.com/expired-or-bad" });
      }
      return jsonResponse({ error: "gone" }, false, 410);
    });

    await expect(fetchWhatsAppMedia(MEDIA_ID, fetchFn)).rejects.toThrow(
      /media bytes download for media_12345 returned 410/i
    );
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  test("second call network failure: throws a clear error", async () => {
    let callCount = 0;
    const fetchFn = jest.fn(async () => {
      callCount += 1;
      if (callCount === 1) {
        return jsonResponse({ url: "https://lookaside.fbsbx.com/whatever" });
      }
      throw new Error("socket hang up");
    });

    await expect(fetchWhatsAppMedia(MEDIA_ID, fetchFn)).rejects.toThrow(/could not download media bytes/i);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  test("WHATSAPP_TOKEN missing/unset: fails loudly before making any network call", async () => {
    delete process.env.WHATSAPP_TOKEN;
    const fetchFn = jest.fn();

    await expect(fetchWhatsAppMedia(MEDIA_ID, fetchFn)).rejects.toThrow(/WHATSAPP_TOKEN is not set/i);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  test("WHATSAPP_TOKEN set to an empty string: also fails loudly before any network call", async () => {
    process.env.WHATSAPP_TOKEN = "";
    const fetchFn = jest.fn();

    await expect(fetchWhatsAppMedia(MEDIA_ID, fetchFn)).rejects.toThrow(/WHATSAPP_TOKEN is not set/i);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
