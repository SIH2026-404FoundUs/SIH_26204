import { describe, test, expect, beforeAll, afterAll, afterEach } from "@jest/globals";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import BusinessAvailability from "../../models/businessAvailability.model.js";
import { eligibleForDiscount } from "./eligibility.js";

let mongod;

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
  await BusinessAvailability.deleteMany({});
});

const businessId = new mongoose.Types.ObjectId();
const destId = "shimla";
const date = "2026-09-10";

const business = {
  _id: businessId,
  priceRangeINR: { min: 2000, max: 3000 },
};

// Every test below passes an explicit pressureFn stub, so eligibility.js's
// `if (!getPressure)` branch — the one that would dynamically import the real
// services/pressure/service.js — is never reached. That module sits at the
// head of a much heavier subsystem (providers, seed loading, precompute job)
// that Sathvik owns and is actively working on; stubbing here keeps this
// suite independent of whatever state that subsystem is in.
const stubPressure = (score) => async () => (score === null ? null : { score });

describe("eligibleForDiscount", () => {
  test("eligible when open and pressure is low", async () => {
    await BusinessAvailability.create({
      businessId,
      date,
      resourceType: "room",
      isOpen: true,
      discountPct: 20,
    });

    const result = await eligibleForDiscount(business, destId, date, stubPressure(0.1));

    expect(result.eligible).toBe(true);
    expect(result.discountPct).toBe(20);
    expect(result.effectivePrice).toBe(1600); // 2000 * (1 - 0.20)
  });

  test("not eligible when isOpen is false", async () => {
    await BusinessAvailability.create({
      businessId,
      date,
      resourceType: "room",
      isOpen: false,
      discountPct: 20,
    });

    const result = await eligibleForDiscount(business, destId, date, stubPressure(0.1));

    expect(result).toEqual({ eligible: false, discountPct: 0, effectivePrice: 2000 });
  });

  test("not eligible when no availability row exists at all", async () => {
    const result = await eligibleForDiscount(business, destId, date, stubPressure(0.1));

    expect(result).toEqual({ eligible: false, discountPct: 0, effectivePrice: 2000 });
  });

  test("not eligible when pressure.score is >= 0.30", async () => {
    await BusinessAvailability.create({
      businessId,
      date,
      resourceType: "room",
      isOpen: true,
      discountPct: 20,
    });

    const result = await eligibleForDiscount(business, destId, date, stubPressure(0.3));

    expect(result).toEqual({ eligible: false, discountPct: 0, effectivePrice: 2000 });
  });

  test("not eligible when pressureFn returns null (unscored destination)", async () => {
    await BusinessAvailability.create({
      businessId,
      date,
      resourceType: "room",
      isOpen: true,
      discountPct: 20,
    });

    const result = await eligibleForDiscount(business, destId, date, stubPressure(null));

    expect(result).toEqual({ eligible: false, discountPct: 0, effectivePrice: 2000 });
  });

  test("not eligible when pressureFn returns undefined", async () => {
    await BusinessAvailability.create({
      businessId,
      date,
      resourceType: "room",
      isOpen: true,
      discountPct: 20,
    });

    const result = await eligibleForDiscount(business, destId, date, async () => undefined);

    expect(result).toEqual({ eligible: false, discountPct: 0, effectivePrice: 2000 });
  });

  test("discountPct is clamped at 40 even if the stored row somehow exceeds it", async () => {
    await BusinessAvailability.collection.insertOne({
      businessId,
      date: new Date(date),
      resourceType: "room",
      isOpen: true,
      discountPct: 75, // bypasses Mongoose's own max:40 validator via a raw driver insert
      source: "business_declared",
      updatedAt: new Date(),
    });

    const result = await eligibleForDiscount(business, destId, date, stubPressure(0.1));

    expect(result.eligible).toBe(true);
    expect(result.discountPct).toBe(40);
    expect(result.effectivePrice).toBe(1200); // 2000 * (1 - 0.40)
  });

  test("effectivePrice math is priceRangeINR.min * (1 - discountPct / 100)", async () => {
    await BusinessAvailability.create({
      businessId,
      date,
      resourceType: "room",
      isOpen: true,
      discountPct: 15,
    });

    const result = await eligibleForDiscount(
      { _id: businessId, priceRangeINR: { min: 1999 } },
      destId,
      date,
      stubPressure(0.05)
    );

    expect(result.effectivePrice).toBeCloseTo(1999 * 0.85, 5);
  });
});
