import { describe, test, expect, beforeAll, afterAll, afterEach } from "@jest/globals";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import BusinessAvailability from "./businessAvailability.model.js";

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  // Compound unique index is built asynchronously after connect; ensure it exists before tests run.
  await BusinessAvailability.init();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await BusinessAvailability.deleteMany({});
});

const validAvailability = () => ({
  _id: "avail_test_homestay_01_20260910",
  businessId: "biz_test_homestay_01",
  date: new Date("2026-09-10"),
  resourceType: "room",
  units: { total: 3, available: 2 },
});

describe("BusinessAvailability model", () => {
  test("saves successfully when all required fields are present", async () => {
    const availability = new BusinessAvailability(validAvailability());
    const saved = await availability.save();

    expect(saved._id).toBeDefined();
    expect(saved.resourceType).toBe("room");
    expect(saved.source).toBe("business_declared");
  });

  test("rejects when source is not business_declared", async () => {
    const availability = new BusinessAvailability({ ...validAvailability(), source: "voice" });
    await expect(availability.save()).rejects.toThrow(mongoose.Error.ValidationError);
  });

  test("rejects when businessId is missing", async () => {
    const availability = new BusinessAvailability({ ...validAvailability(), businessId: undefined });
    await expect(availability.save()).rejects.toThrow(mongoose.Error.ValidationError);
  });

  test("rejects when date is missing", async () => {
    const availability = new BusinessAvailability({ ...validAvailability(), date: undefined });
    await expect(availability.save()).rejects.toThrow(mongoose.Error.ValidationError);
  });

  test("rejects when resourceType is missing", async () => {
    const availability = new BusinessAvailability({ ...validAvailability(), resourceType: undefined });
    await expect(availability.save()).rejects.toThrow(mongoose.Error.ValidationError);
  });

  test("rejects when resourceType is not one of the enum values", async () => {
    const availability = new BusinessAvailability({ ...validAvailability(), resourceType: "bed" });
    await expect(availability.save()).rejects.toThrow(mongoose.Error.ValidationError);
  });

  test("rejects when discountPct exceeds 40", async () => {
    const availability = new BusinessAvailability({ ...validAvailability(), discountPct: 41 });
    await expect(availability.save()).rejects.toThrow(mongoose.Error.ValidationError);
  });

  test("accepts discountPct at exactly 40", async () => {
    const availability = new BusinessAvailability({ ...validAvailability(), discountPct: 40 });
    const saved = await availability.save();
    expect(saved.discountPct).toBe(40);
  });

  test("throws on duplicate (businessId, date, resourceType)", async () => {
    const businessId = "biz_test_homestay_02";
    const date = new Date("2026-09-10");
    const units = { total: 3, available: 2 };

    await new BusinessAvailability({ _id: "avail_test_02_a", businessId, date, resourceType: "room", units }).save();

    await expect(
      new BusinessAvailability({ _id: "avail_test_02_b", businessId, date, resourceType: "room", units }).save()
    ).rejects.toThrow(/E11000/);
  });

  test("allows the same (businessId, date) with a different resourceType", async () => {
    const businessId = "biz_test_homestay_03";
    const date = new Date("2026-09-10");
    const units = { total: 3, available: 2 };

    await new BusinessAvailability({ _id: "avail_test_03_a", businessId, date, resourceType: "room", units }).save();

    const differentResourceType = new BusinessAvailability({
      _id: "avail_test_03_b",
      businessId,
      date,
      resourceType: "seat",
      units,
    });
    await expect(differentResourceType.save()).resolves.toBeDefined();
  });
});
