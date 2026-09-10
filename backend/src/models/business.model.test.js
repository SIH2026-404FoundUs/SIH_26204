import { describe, test, expect, beforeAll, afterAll, afterEach } from "@jest/globals";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Business from "./business.model.js";
import { REQUIRED_FIELDS_FOR_LIVE, hasRequiredFieldsForLive } from "../services/onboarding/stateMachine.js";
import { getNextFollowUpQuestion } from "../services/onboarding/followUp.js";

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Business.init();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await Business.deleteMany({});
});

const validBusiness = () => ({
  _id: "biz_test_green_valley",
  destId: "shimla",
  name: "Green Valley Homestay",
  type: "homestay",
  ownerPhone: "+919876543210",
});

describe("Business model", () => {
  test("saves successfully when all required fields are present", async () => {
    const business = new Business(validBusiness());
    const saved = await business.save();

    expect(saved._id).toBeDefined();
    expect(saved.name).toBe("Green Valley Homestay");
  });

  test("rejects when destId is missing", async () => {
    const business = new Business({ ...validBusiness(), destId: undefined });
    await expect(business.save()).rejects.toThrow(mongoose.Error.ValidationError);
  });

  test("rejects when name is missing", async () => {
    const business = new Business({ ...validBusiness(), name: undefined });
    await expect(business.save()).rejects.toThrow(mongoose.Error.ValidationError);
  });

  test("rejects when type is missing", async () => {
    const business = new Business({ ...validBusiness(), type: undefined });
    await expect(business.save()).rejects.toThrow(mongoose.Error.ValidationError);
  });

  test("rejects when ownerPhone is missing", async () => {
    const business = new Business({ ...validBusiness(), ownerPhone: undefined });
    await expect(business.save()).rejects.toThrow(mongoose.Error.ValidationError);
  });

  test("rejects when type is not one of the enum values", async () => {
    const business = new Business({ ...validBusiness(), type: "hotel" });
    await expect(business.save()).rejects.toThrow(mongoose.Error.ValidationError);
  });

  test("rejects when verificationTier is not one of the enum values", async () => {
    const business = new Business({ ...validBusiness(), verificationTier: "trusted" });
    await expect(business.save()).rejects.toThrow(mongoose.Error.ValidationError);
  });

  test("enforces uniqueness on ownerPhone", async () => {
    await new Business(validBusiness()).save();

    const duplicate = new Business({
      ...validBusiness(),
      _id: "biz_test_another_homestay",
      name: "Another Homestay",
    });

    await expect(duplicate.save()).rejects.toThrow(/E11000/);
  });

  test("excludes ownerPhone and povSecret from default query results", async () => {
    await new Business({ ...validBusiness(), povSecret: "top-secret" }).save();

    const found = await Business.findOne({ name: "Green Valley Homestay" });

    expect(found.ownerPhone).toBeUndefined();
    expect(found.povSecret).toBeUndefined();
  });

  // bharani-tasks.md Section 1.5 (registration assist) fields.
  describe("registration-assist fields (Section 1.5)", () => {
    test("saves and round-trips ownerName, propertyAddress, roomsLet, ownerResidesOnPremises", async () => {
      const business = new Business({
        ...validBusiness(),
        ownerName: "Suresh Kumar",
        propertyAddress: {
          village: "Kufri",
          street: "Near Ridge Road",
          district: "Shimla",
          pincode: "171012",
        },
        roomsLet: 3,
        ownerResidesOnPremises: true,
      });
      const saved = await business.save();

      expect(saved.ownerName).toBe("Suresh Kumar");
      expect(saved.propertyAddress).toMatchObject({
        village: "Kufri",
        street: "Near Ridge Road",
        district: "Shimla",
        pincode: "171012",
      });
      expect(saved.roomsLet).toBe(3);
      expect(saved.ownerResidesOnPremises).toBe(true);
    });

    test("roomsLet and capacity are independent — a business can have different values for each", async () => {
      // The whole point of the gap analysis: rooms let (for registration)
      // is not the same number as guest capacity.
      const business = new Business({ ...validBusiness(), capacity: 6, roomsLet: 3 });
      const saved = await business.save();

      expect(saved.capacity).toBe(6);
      expect(saved.roomsLet).toBe(3);
      expect(saved.capacity).not.toBe(saved.roomsLet);
    });

    test("none of the four registration-assist fields are required — a business saves fine without them", async () => {
      const business = new Business(validBusiness());
      const saved = await business.save();

      expect(saved.ownerName).toBeUndefined();
      expect(saved.roomsLet).toBeUndefined();
      expect(saved.ownerResidesOnPremises).toBeUndefined();
      expect(saved.propertyAddress?.village).toBeUndefined();
    });

    test("none of the four registration-assist fields are in REQUIRED_FIELDS_FOR_LIVE", () => {
      expect(REQUIRED_FIELDS_FOR_LIVE).not.toContain("ownerName");
      expect(REQUIRED_FIELDS_FOR_LIVE).not.toContain("propertyAddress");
      expect(REQUIRED_FIELDS_FOR_LIVE).not.toContain("roomsLet");
      expect(REQUIRED_FIELDS_FOR_LIVE).not.toContain("ownerResidesOnPremises");
    });

    test("ownerResidesOnPremises correctly stores false, not just truthy/absent", async () => {
      const business = new Business({ ...validBusiness(), ownerResidesOnPremises: false });
      const saved = await business.save();

      expect(saved.ownerResidesOnPremises).toBe(false);
    });

    test("propertyAddress fields are individually optional", async () => {
      const business = new Business({
        ...validBusiness(),
        propertyAddress: { district: "Shimla" }, // village/street/pincode omitted
      });
      const saved = await business.save();

      expect(saved.propertyAddress.district).toBe("Shimla");
      expect(saved.propertyAddress.village).toBeUndefined();
    });
  });
});

describe("priceRangeINR missing-field detection (Mongoose {} default regression)", () => {
  // Confirmed while tracing the FOLLOWUP loop: Mongoose auto-instantiates
  // a nested-object schema path (priceRangeINR: { min, max }) as `{}` the
  // instant a document is created, even when nothing was ever written to
  // it — a plain `!== null && !== undefined` check therefore treats a
  // completely empty price range as "already known." These tests prove
  // the fix (isRequiredFieldPresent in stateMachine.js) against a REAL
  // Mongoose document, not a hand-constructed plain object that might not
  // reproduce Mongoose's actual default behavior.
  test("a freshly-created draft's priceRangeINR really is {} by Mongoose default, not null/undefined", async () => {
    const saved = await Business.findOneAndUpdate(
      { _id: "biz_test_pricerange_default" },
      {
        $set: {
          ownerPhone: "+919000000030",
          destId: "shimla",
          onboardingState: "EXTRACTING",
          name: "Test Homestay",
          type: "homestay",
          capacity: 4,
          nearestLandmark: "Main Chowk",
        },
      },
      { upsert: true, new: true, runValidators: true, context: "query" }
    );

    expect(saved.priceRangeINR).not.toBeNull();
    expect(saved.priceRangeINR).not.toBeUndefined();
    expect(saved.priceRangeINR.min).toBeUndefined();
    expect(saved.priceRangeINR.max).toBeUndefined();
  });

  test("hasRequiredFieldsForLive correctly reports false for a real document with only a Mongoose-defaulted {} priceRangeINR", async () => {
    const saved = await Business.findOneAndUpdate(
      { _id: "biz_test_pricerange_live_gate" },
      {
        $set: {
          ownerPhone: "+919000000031",
          destId: "shimla",
          onboardingState: "EXTRACTING",
          name: "Test Homestay",
          type: "homestay",
          capacity: 4,
          nearestLandmark: "Main Chowk",
          // priceRangeINR intentionally never set -- Mongoose defaults it.
        },
      },
      { upsert: true, new: true, runValidators: true, context: "query" }
    );

    // Every OTHER required field really is present -- isolates the
    // failure to priceRangeINR specifically, not a fixture mistake.
    expect(saved.name).toBeTruthy();
    expect(saved.type).toBeTruthy();
    expect(saved.capacity).toBeTruthy();
    expect(saved.nearestLandmark).toBeTruthy();
    expect(saved.destId).toBeTruthy();

    expect(hasRequiredFieldsForLive(saved)).toBe(false);
  });

  test("hasRequiredFieldsForLive correctly reports true once priceRangeINR genuinely has both min and max", async () => {
    const saved = await Business.findOneAndUpdate(
      { _id: "biz_test_pricerange_complete" },
      {
        $set: {
          ownerPhone: "+919000000032",
          destId: "shimla",
          onboardingState: "EXTRACTING",
          name: "Test Homestay",
          type: "homestay",
          capacity: 4,
          nearestLandmark: "Main Chowk",
          priceRangeINR: { min: 1000, max: 2000 },
        },
      },
      { upsert: true, new: true, runValidators: true, context: "query" }
    );

    expect(hasRequiredFieldsForLive(saved)).toBe(true);
  });

  test("getNextFollowUpQuestion correctly asks about priceRangeINR for a real document with the Mongoose-defaulted {} value, not silently skipping it", async () => {
    const saved = await Business.findOneAndUpdate(
      { _id: "biz_test_pricerange_followup" },
      {
        $set: {
          ownerPhone: "+919000000033",
          destId: "shimla",
          onboardingState: "EXTRACTING",
          name: "Test Homestay",
          type: "homestay",
          capacity: 4,
          nearestLandmark: "Main Chowk",
          // priceRangeINR still missing -- everything else required is present.
        },
      },
      { upsert: true, new: true, runValidators: true, context: "query" }
    );

    const question = getNextFollowUpQuestion(saved, "en");
    expect(question).toBe("What is your price range per night, in rupees?");
  });
});
