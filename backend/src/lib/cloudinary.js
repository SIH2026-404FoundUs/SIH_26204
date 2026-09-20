import { v2 as cloudinary } from "cloudinary";

import { config } from "dotenv";

config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default cloudinary;

// Every stored Cloudinary URL is the raw secure_url from upload time --
// full resolution, whatever format the client sent it in. Cloudinary can
// re-encode and resize on the fly for free just by inserting a
// transformation segment into the delivery URL (no re-upload, no new
// dependency): q_auto picks the smallest acceptable quality, f_auto picks
// the smallest acceptable format (WebP/AVIF where the requester supports
// it), and an explicit width caps how large a thumbnail/card image ever
// needs to be for where it's actually displayed. Card/list views should
// always pass a width; a detail view showing one photo large can omit it.
export function optimizedImageUrl(url, { width } = {}) {
  if (typeof url !== "string" || !url.includes("/upload/")) return url;
  const transform = ["q_auto", "f_auto", width ? `w_${Math.round(width)}` : null].filter(Boolean).join(",");
  return url.replace("/upload/", `/upload/${transform}/`);
}