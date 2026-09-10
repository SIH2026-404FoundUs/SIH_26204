import { describe, test, expect, beforeAll, afterAll, afterEach } from "@jest/globals";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import DestinationDemand from "./destinationDemand.model.js";

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
  await DestinationDemand.deleteMany({});
});

const validDemand = () => ({
  destId: "shimla",
  date: new Date("2026-09-10"),
  travellers: 12,
  estimatedRooms: 5,
});

describe("DestinationDemand model", () => {
  test("saves successfully when all required fields are present", async () => {
    const demand = new DestinationDemand(validDemand());
    const saved = await demand.save();

    expect(saved._id).toBeDefined();
    expect(saved.destId).toBe("shimla");
    expect(saved.generatedFrom).toBe("trip_planning");
  });

  test("rejects when destId is missing", async () => {
    const demand = new DestinationDemand({ ...validDemand(), destId: undefined });
    await expect(demand.save()).rejects.toThrow(mongoose.Error.ValidationError);
  });

  test("rejects when date is missing", async () => {
    const demand = new DestinationDemand({ ...validDemand(), date: undefined });
    await expect(demand.save()).rejects.toThrow(mongoose.Error.ValidationError);
  });

  test("rejects when generatedFrom is not one of the enum values", async () => {
    const demand = new DestinationDemand({ ...validDemand(), generatedFrom: "manual_guess" });
    await expect(demand.save()).rejects.toThrow(mongoose.Error.ValidationError);
  });

  test("defaults generatedFrom to trip_planning when omitted", async () => {
    const demand = new DestinationDemand(validDemand());
    const saved = await demand.save();
    expect(saved.generatedFrom).toBe("trip_planning");
  });
});
