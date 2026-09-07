import { describe, test, expect, jest } from "@jest/globals";
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

  test("default (unconfigured) path throws a clear, actionable error instead of failing silently", async () => {
    await expect(transcribeAudio(Buffer.from("audio"))).rejects.toThrow(
      /not implemented yet.*wire up faster-whisper/i
    );
  });

  test("explicitly passing undefined for transcribeFn also falls back to the default stub", async () => {
    await expect(transcribeAudio(Buffer.from("audio"), undefined)).rejects.toThrow(/faster-whisper/i);
  });

  test("the default path never returns a fabricated result — it only ever rejects", async () => {
    await expect(transcribeAudio(Buffer.from("audio"))).rejects.toBeInstanceOf(Error);
  });
});
