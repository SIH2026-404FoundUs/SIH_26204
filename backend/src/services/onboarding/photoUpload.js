// Voice Onboarding — bharani-tasks.md Section 1.1's AWAITING_PHOTOS: "3-5
// images -> Cloudinary".
//
// src/lib/cloudinary.js already exists, fully configured, with zero
// current consumers (confirmed via repo-wide grep) — the profilePic
// upload that used to call it was removed, but the removal commit itself
// says it was kept specifically for this. That old pattern called
// cloudinary.uploader.upload(profilePic) with a string (base64 data URI)
// in req.body; this is a raw Buffer from fetchWhatsAppMedia() instead, so
// upload_stream() is used, not upload().
//
// uploadFn is injected the same way sendMessageFn/extractFn are: defaults
// to the real Cloudinary call, tests supply a stub, so this module never
// makes a real upload during test runs.

import cloudinary from "../../lib/cloudinary.js";

/**
 * Real upload backend. Streams `imageBuffer` to Cloudinary and resolves
 * with the resulting secure_url.
 *
 * @param {Buffer} imageBuffer
 * @returns {Promise<string>}
 */
function uploadViaCloudinaryStream(imageBuffer) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: "onboarding-photos", resource_type: "image" },
      (error, result) => {
        if (error) {
          reject(new Error(`uploadPhotoToCloudinary: Cloudinary upload failed (${error.message})`));
          return;
        }
        if (!result?.secure_url) {
          reject(new Error("uploadPhotoToCloudinary: Cloudinary response had no secure_url"));
          return;
        }
        resolve(result.secure_url);
      }
    );
    uploadStream.end(imageBuffer);
  });
}

/**
 * Uploads a photo (raw image bytes) and returns its hosted URL. Delegates
 * to `uploadFn`, defaulting to the real Cloudinary-backed implementation
 * above.
 *
 * @param {Buffer} imageBuffer
 * @param {(imageBuffer: Buffer) => Promise<string>} [uploadFn] - defaults to uploadViaCloudinaryStream.
 * @returns {Promise<string>} the uploaded photo's URL.
 */
export async function uploadPhotoToCloudinary(imageBuffer, uploadFn = uploadViaCloudinaryStream) {
  return uploadFn(imageBuffer);
}
