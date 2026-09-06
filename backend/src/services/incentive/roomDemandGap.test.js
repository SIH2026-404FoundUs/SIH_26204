import { describe, test, expect, beforeAll, afterAll, afterEach } from "@jest/globals";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Business from "../../models/business.model.js";
import BusinessAvailability from "../../models/businessAvailability.model.js";
import { roomDemandGap } from "./roomDemandGap.js";

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
  await BusinessAvailability.deleteMany({});
});

const destId = "shimla";
const otherDestId = "manali";
const date = new Date("2026-09-10");

let ownerPhoneCounter = 0;
async function makeBusiness(destIdForBusiness = destId) {
  ownerPhoneCounter += 1;
  return Business.create({
    destId: destIdForBusiness,
    name: `Test Homestay ${ownerPhoneCounter}`,
    type: "homestay",
    ownerPhone: `+9199900000${String(ownerPhoneCounter).padStart(2, "0")}`,
  });
}

describe("roomDemandGap", () => {
  test("positive gap when demand exceeds availability", async () => {
    const business = await makeBusiness();
    await BusinessAvailability.create({
      businessId: business._id,
      date,
      resourceType: "room",
      units: { total: 5, available: 4 },
      isOpen: true,
    });

    const result = await roomDemandGap(destId, date, 10);

    expect(result.estimatedRooms).toBe(10);
    expect(result.availableRooms).toBe(4);
    expect(result.roomDemandGap).toBe(6);
  });

  test("negative gap when availability exceeds demand", async () => {
    const business = await makeBusiness();
    await BusinessAvailability.create({
      businessId: business._id,
      date,
      resourceType: "room",
      units: { total: 12, available: 10 },
      isOpen: true,
    });

    const result = await roomDemandGap(destId, date, 3);

    expect(result.availableRooms).toBe(10);
    expect(result.roomDemandGap).toBe(-7);
  });

  test("zero availableRooms when the destination has no availability rows at all", async () => {
    // No businesses at all for this destId.
    const result = await roomDemandGap(destId, date, 8);

    expect(result.availableRooms).toBe(0);
    expect(result.roomDemandGap).toBe(8);
  });

  test("zero availableRooms when businesses exist but none have an availability row for that date", async () => {
    await makeBusiness();

    const result = await roomDemandGap(destId, date, 8);

    expect(result.availableRooms).toBe(0);
    expect(result.roomDemandGap).toBe(8);
  });

  test("sums units.available across multiple businesses and resourceTypes for the same destId/date", async () => {
    const businessA = await makeBusiness();
    const businessB = await makeBusiness();

    await BusinessAvailability.create({
      businessId: businessA._id,
      date,
      resourceType: "room",
      units: { total: 3, available: 2 },
      isOpen: true,
    });
    await BusinessAvailability.create({
      businessId: businessA._id,
      date,
      resourceType: "table",
      units: { total: 4, available: 3 },
      isOpen: true,
    });
    await BusinessAvailability.create({
      businessId: businessB._id,
      date,
      resourceType: "room",
      units: { total: 6, available: 5 },
      isOpen: true,
    });

    const result = await roomDemandGap(destId, date, 20);

    expect(result.availableRooms).toBe(10); // 2 + 3 + 5
    expect(result.roomDemandGap).toBe(10);
  });

  test("only counts availability belonging to businesses at the requested destId", async () => {
    const localBusiness = await makeBusiness(destId);
    const otherBusiness = await makeBusiness(otherDestId);

    await BusinessAvailability.create({
      businessId: localBusiness._id,
      date,
      resourceType: "room",
      units: { total: 5, available: 5 },
      isOpen: true,
    });
    await BusinessAvailability.create({
      businessId: otherBusiness._id,
      date,
      resourceType: "room",
      units: { total: 100, available: 100 },
      isOpen: true,
    });

    const result = await roomDemandGap(destId, date, 5);

    expect(result.availableRooms).toBe(5); // otherDestId's 100 must not leak in
    expect(result.roomDemandGap).toBe(0);
  });

  test("the returned field is named roomDemandGap, never capacityGap", async () => {
    const result = await roomDemandGap(destId, date, 5);

    expect(result).toHaveProperty("roomDemandGap");
    expect(result.capacityGap).toBeUndefined();
    expect(Object.keys(result)).not.toContain("capacityGap");
  });

  test("capacityGap never appears anywhere in roomDemandGap.js's source", () => {
    const sourcePath = join(dirname(fileURLToPath(import.meta.url)), "roomDemandGap.js");
    const source = readFileSync(sourcePath, "utf8");

    // Only exception: the explanatory comment contrasting the two fields by name.
    const codeWithoutComments = source
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");

    expect(codeWithoutComments).not.toMatch(/capacityGap/);
  });
});
