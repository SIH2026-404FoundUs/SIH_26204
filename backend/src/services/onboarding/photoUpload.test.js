import { describe, test, expect, jest } from "@jest/globals";
import { uploadPhotoToCloudinary } from "./photoUpload.js";

describe("uploadPhotoToCloudinary", () => {
  test("passes the buffer through to uploadFn and returns its result verbatim", async () => {
    const stub = jest.fn().mockResolvedValue("https://res.cloudinary.com/test/image/upload/v1/photo.jpg");
    const buffer = Buffer.from("fake image bytes");

    const result = await uploadPhotoToCloudinary(buffer, stub);

    expect(stub).toHaveBeenCalledTimes(1);
    expect(stub).toHaveBeenCalledWith(buffer);
    expect(result).toBe("https://res.cloudinary.com/test/image/upload/v1/photo.jpg");
  });

  test("propagates a rejection from uploadFn rather than swallowing it", async () => {
    const failingStub = jest.fn().mockRejectedValue(new Error("Cloudinary quota exceeded"));

    await expect(uploadPhotoToCloudinary(Buffer.from("x"), failingStub)).rejects.toThrow("Cloudinary quota exceeded");
  });

  test("works with a synchronous uploadFn too (still awaited correctly)", async () => {
    const syncStub = jest.fn(() => "https://res.cloudinary.com/test/sync.jpg");

    const result = await uploadPhotoToCloudinary(Buffer.from("x"), syncStub);

    expect(result).toBe("https://res.cloudinary.com/test/sync.jpg");
  });
});
