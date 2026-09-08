import { describe, test, expect, jest, beforeAll, afterAll, beforeEach, afterEach } from "@jest/globals";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Business from "../../models/business.model.js";
import BusinessAvailability from "../../models/businessAvailability.model.js";
import { processInboundAudio } from "./processInboundAudio.js";
import { parseAvailabilityDates, parseUnitCount, generateDateRange } from "./dateParser.js";

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

describe("dateParser unit tests", () => {
  test("parses 'October 10 to October 20' with correct inclusive range", () => {
    const res = parseAvailabilityDates("October 10 to October 20", 2026);
    expect(res).not.toBeNull();
    expect(res.startDate.toISOString()).toBe("2026-10-10T00:00:00.000Z");
    expect(res.endDate.toISOString()).toBe("2026-10-20T00:00:00.000Z");

    const dates = generateDateRange(res.startDate, res.endDate);
    expect(dates.length).toBe(11); // Oct 10 through Oct 20 inclusive
    expect(dates[0].toISOString()).toBe("2026-10-10T00:00:00.000Z");
    expect(dates[10].toISOString()).toBe("2026-10-20T00:00:00.000Z");
  });

  test("parses '10th October to 20th October'", () => {
    const res = parseAvailabilityDates("10th October to 20th October", 2026);
    expect(res).not.toBeNull();
    expect(res.startDate.toISOString()).toBe("2026-10-10T00:00:00.000Z");
    expect(res.endDate.toISOString()).toBe("2026-10-20T00:00:00.000Z");
  });

  test("parses 'from October 10 until October 20'", () => {
    const res = parseAvailabilityDates("from October 10 until October 20", 2026);
    expect(res).not.toBeNull();
    expect(res.startDate.toISOString()).toBe("2026-10-10T00:00:00.000Z");
    expect(res.endDate.toISOString()).toBe("2026-10-20T00:00:00.000Z");
  });

  test("parses single date 'October 10'", () => {
    const res = parseAvailabilityDates("October 10", 2026);
    expect(res).not.toBeNull();
    expect(res.startDate.toISOString()).toBe("2026-10-10T00:00:00.000Z");
    expect(res.endDate.toISOString()).toBe("2026-10-10T00:00:00.000Z");
    const dates = generateDateRange(res.startDate, res.endDate);
    expect(dates.length).toBe(1);
  });

  test("returns null for invalid or unparseable dates", () => {
    expect(parseAvailabilityDates("someday soon")).toBeNull();
    expect(parseAvailabilityDates("hello world")).toBeNull();
    expect(parseAvailabilityDates("")).toBeNull();
  });

  test("parses unit count from digits and words", () => {
    expect(parseUnitCount("I have 3 rooms")).toBe(3);
    expect(parseUnitCount("we have three rooms")).toBe(3);
    expect(parseUnitCount("teen kamre hain")).toBe(3);
    expect(parseUnitCount("5 units")).toBe(5);
    expect(parseUnitCount("2 tables")).toBe(2);
  });

  test("returns null when unit count is missing or ambiguous", () => {
    expect(parseUnitCount("I am open in October")).toBeNull();
    expect(parseUnitCount("many rooms")).toBeNull();
  });
});

describe("AWAITING_DATES voice onboarding flow", () => {
  test("valid date range + units: creates BusinessAvailability records, sets source 'voice', transitions to DRAFT_CONFIRM, sends confirmation", async () => {
    await Business.create({
      _id: "biz_test_dates_1",
      ownerPhone: "919111111101",
      onboardingState: "AWAITING_DATES",
      destId: "shimla",
      name: "Sunrise Homestay",
      priceRangeINR: { min: 1200, max: 2000 },
      transcriptLang: "en",
    });

    const sendMessageFn = jest.fn();
    const transcribeFn = async () => ({
      transcript: "I'm available from October 10 to October 20, I have 3 rooms.",
      detectedLanguage: "en",
    });

    const result = await processInboundAudio({
      audioBuffer: stubAudio,
      ownerPhone: "919111111101",
      messageId: "wamid.dates.1",
      transcribeFn,
      sendMessageFn,
    });

    expect(result.applied).toBe(true);
    expect(result.onboardingState).toBe("DRAFT_CONFIRM");
    expect(result.availability.recordCount).toBe(11);
    expect(result.availability.units).toBe(3);
    expect(result.availability.resourceType).toBe("room");

    // Verify Business in DB
    const savedBiz = await Business.findOne({ _id: "biz_test_dates_1" });
    expect(savedBiz.onboardingState).toBe("DRAFT_CONFIRM");

    // Verify BusinessAvailability records in DB
    const records = await BusinessAvailability.find({ businessId: "biz_test_dates_1" }).sort({ date: 1 });
    expect(records.length).toBe(11); // Oct 10 - Oct 20 inclusive
    for (const rec of records) {
      expect(rec.businessId).toBe("biz_test_dates_1");
      expect(rec.resourceType).toBe("room");
      expect(rec.units).toEqual({ total: 3, available: 3 });
      expect(rec.pricePerNight).toBe(1200);
      expect(rec.isOpen).toBe(true);
      expect(rec.source).toBe("business_declared");
    }

    // Verify confirmation message was sent
    expect(sendMessageFn).toHaveBeenCalledTimes(1);
    expect(sendMessageFn).toHaveBeenCalledWith(
      "919111111101",
      expect.stringContaining("availability dates and units have been recorded")
    );
  });

  test("single date: creates exactly 1 record and transitions", async () => {
    await Business.create({
      _id: "biz_test_dates_single",
      ownerPhone: "919111111102",
      onboardingState: "AWAITING_DATES",
      destId: "shimla",
      priceRangeINR: { min: 1000, max: 1500 },
    });

    const sendMessageFn = jest.fn();
    const transcribeFn = async () => ({
      transcript: "Available on October 15 with 2 rooms.",
      detectedLanguage: "en",
    });

    const result = await processInboundAudio({
      audioBuffer: stubAudio,
      ownerPhone: "919111111102",
      messageId: "wamid.dates.2",
      transcribeFn,
      sendMessageFn,
    });

    expect(result.applied).toBe(true);
    expect(result.onboardingState).toBe("DRAFT_CONFIRM");
    expect(result.availability.recordCount).toBe(1);

    const records = await BusinessAvailability.find({ businessId: "biz_test_dates_single" });
    expect(records.length).toBe(1);
    expect(records[0].source).toBe("business_declared");
    expect(records[0].units).toEqual({ total: 2, available: 2 });
  });

  test("invalid or ambiguous dates: does not transition, sends invalid-dates follow-up", async () => {
    await Business.create({
      _id: "biz_test_dates_invalid",
      ownerPhone: "919111111103",
      onboardingState: "AWAITING_DATES",
      destId: "shimla",
    });

    const sendMessageFn = jest.fn();
    const transcribeFn = async () => ({
      transcript: "We will be open sometime around Diwali, 3 rooms.",
      detectedLanguage: "en",
    });

    const result = await processInboundAudio({
      audioBuffer: stubAudio,
      ownerPhone: "919111111103",
      messageId: "wamid.dates.3",
      transcribeFn,
      sendMessageFn,
    });

    expect(result.applied).toBe(false);
    expect(result.reason).toBe("invalid_dates");
    expect(result.onboardingState).toBe("AWAITING_DATES");

    const savedBiz = await Business.findOne({ _id: "biz_test_dates_invalid" });
    expect(savedBiz.onboardingState).toBe("AWAITING_DATES");

    const records = await BusinessAvailability.find({ businessId: "biz_test_dates_invalid" });
    expect(records.length).toBe(0);

    expect(sendMessageFn).toHaveBeenCalledTimes(1);
    expect(sendMessageFn).toHaveBeenCalledWith(
      "919111111103",
      expect.stringContaining("couldn't clearly understand your availability dates")
    );
  });

  test("missing unit count: does not transition, sends missing-units follow-up", async () => {
    await Business.create({
      _id: "biz_test_dates_nounits",
      ownerPhone: "919111111104",
      onboardingState: "AWAITING_DATES",
      destId: "shimla",
    });

    const sendMessageFn = jest.fn();
    const transcribeFn = async () => ({
      transcript: "Open from October 10 to October 20.",
      detectedLanguage: "en",
    });

    const result = await processInboundAudio({
      audioBuffer: stubAudio,
      ownerPhone: "919111111104",
      messageId: "wamid.dates.4",
      transcribeFn,
      sendMessageFn,
    });

    expect(result.applied).toBe(false);
    expect(result.reason).toBe("missing_units");
    expect(result.onboardingState).toBe("AWAITING_DATES");

    const savedBiz = await Business.findOne({ _id: "biz_test_dates_nounits" });
    expect(savedBiz.onboardingState).toBe("AWAITING_DATES");

    const records = await BusinessAvailability.find({ businessId: "biz_test_dates_nounits" });
    expect(records.length).toBe(0);

    expect(sendMessageFn).toHaveBeenCalledTimes(1);
    expect(sendMessageFn).toHaveBeenCalledWith(
      "919111111104",
      expect.stringContaining("how many rooms or units are available")
    );
  });

  test("duplicate or re-declared availability: upserts existing records without creating duplicate keys or throwing E11000", async () => {
    await Business.create({
      _id: "biz_test_dates_duplicate",
      ownerPhone: "919111111105",
      onboardingState: "AWAITING_DATES",
      destId: "shimla",
    });

    const sendMessageFn = jest.fn();
    const transcribeFn = async () => ({
      transcript: "October 10 to October 12, 2 rooms.",
      detectedLanguage: "en",
    });

    // First declaration
    await processInboundAudio({
      audioBuffer: stubAudio,
      ownerPhone: "919111111105",
      messageId: "wamid.dates.5a",
      transcribeFn,
      sendMessageFn,
    });

    let records = await BusinessAvailability.find({ businessId: "biz_test_dates_duplicate" });
    expect(records.length).toBe(3); // 10, 11, 12

    // Reset draft back to AWAITING_DATES to simulate updating availability
    await Business.updateOne({ _id: "biz_test_dates_duplicate" }, { onboardingState: "AWAITING_DATES" });

    // Second declaration over the same dates with updated 4 rooms
    const transcribeFn2 = async () => ({
      transcript: "October 10 to October 12, 4 rooms.",
      detectedLanguage: "en",
    });

    const result2 = await processInboundAudio({
      audioBuffer: stubAudio,
      ownerPhone: "919111111105",
      messageId: "wamid.dates.5b",
      transcribeFn: transcribeFn2,
      sendMessageFn,
    });

    expect(result2.applied).toBe(true);
    records = await BusinessAvailability.find({ businessId: "biz_test_dates_duplicate" });
    expect(records.length).toBe(3); // strictly 3 records, not 6
    for (const rec of records) {
      expect(rec.units).toEqual({ total: 4, available: 4 });
      expect(rec.source).toBe("business_declared");
    }
  });
});
