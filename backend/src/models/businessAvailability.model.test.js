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
  businessId: new mongoose.Types.ObjectId(),
  date: new Date("2026-09-10"),
  resourceType: "room",
});

describe("BusinessAvailability model", () => {
  test("saves successfully when all required fields are present", async () => {
    const availability = new BusinessAvailability(validAvailability());
    const saved = await availability.save();

    expect(saved._id).toBeDefined();
    expect(saved.resourceType).toBe("room");
    expect(saved.source).toBe("business_declared");
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
    const businessId = new mongoose.Types.ObjectId();
    const date = new Date("2026-09-10");

    await new BusinessAvailability({ businessId, date, resourceType: "room" }).save();

    await expect(
      new BusinessAvailability({ businessId, date, resourceType: "room" }).save()
    ).rejects.toThrow(/E11000/);
  });

  test("allows the same (businessId, date) with a different resourceType", async () => {
    const businessId = new mongoose.Types.ObjectId();
    const date = new Date("2026-09-10");

    await new BusinessAvailability({ businessId, date, resourceType: "room" }).save();

    const differentResourceType = new BusinessAvailability({ businessId, date, resourceType: "seat" });
    await expect(differentResourceType.save()).resolves.toBeDefined();
  });
});
