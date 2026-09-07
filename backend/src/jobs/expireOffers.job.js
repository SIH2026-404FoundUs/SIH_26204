// Spec §2.2 — "a 1-minute scheduled job flips expired 'open' offers to 'expired'".
// The atomic claim in offerService.js already refuses expiresAt-passed offers on
// its own (findOneAndUpdate filters expiresAt:{$gt:now}), and Mongo's TTL index
// on Offer.expiresAt reaps the documents outright a little later — this job just
// keeps `status` honest for anything listing offers in the gap between the two.

import { argv } from "node:process";
import { pathToFileURL } from "node:url";
import { expireOffersJob } from "../services/waitlist/offerService.js";
import Offer from "../models/offer.model.js";

export async function runExpireOffers() {
  return expireOffersJob({ OfferModel: Offer });
}

// CLI: `node src/jobs/expireOffers.job.js` — wire into a real 1-minute cron for the demo.
if (argv[1] && import.meta.url === pathToFileURL(argv[1]).href) {
  const [{ connectDB }, dotenv] = await Promise.all([import("../lib/db.js"), import("dotenv")]);
  dotenv.default.config();
  await connectDB();
  console.log("expire-offers:", await runExpireOffers());
  process.exit(0);
}
