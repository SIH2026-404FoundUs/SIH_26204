import { describe, test, expect, beforeAll, afterAll, afterEach } from "@jest/globals";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Business from "./business.model.js";

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
});

const validBusiness = () => ({
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
});
