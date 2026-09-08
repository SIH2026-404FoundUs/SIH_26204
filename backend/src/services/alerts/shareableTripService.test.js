import { tripBelongsToUser } from "./shareableTripService.js";
import { jest } from "@jest/globals";

describe("shareable trip ownership", () => {
  test("accepts only a trip owned by the authenticated user", async () => {
    const select = jest.fn().mockResolvedValue({ _id: "trip-1" });
    const findOne = jest.fn().mockReturnValue({ select });
    const TripModel = { findOne };

    await expect(tripBelongsToUser("trip-1", "user-1", TripModel)).resolves.toBe(true);
    expect(findOne).toHaveBeenCalledWith({ _id: "trip-1", userId: "user-1" });
  });

  test("rejects a trip owned by another user", async () => {
    const TripModel = { findOne: () => ({ select: () => Promise.resolve(null) }) };

    await expect(tripBelongsToUser("trip-1", "user-2", TripModel)).resolves.toBe(false);
  });
});
