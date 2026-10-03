// backend/src/seeds/migrate_fares_from_mongo.js
// Usage:
//   node backend/src/seeds/migrate_fares_from_mongo.js --dry-run
//   node backend/src/seeds/migrate_fares_from_mongo.js
//   node backend/src/seeds/migrate_fares_from_mongo.js --yes

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { askConfirmation } from "./_lib/cliPrompt.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../../.env") });

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/tourism_platform";

function roundVal(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return null;
  return Math.round(Number(v));
}

async function migrateFares() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");
  const skipConfirm = args.includes("--yes");

  const seedsDir = __dirname;
  const targetPath = path.join(seedsDir, "fares.json");

  // Read existing fares.json to preserve generic
  let existingGeneric = null;
  if (fs.existsSync(targetPath)) {
    try {
      const existingData = JSON.parse(fs.readFileSync(targetPath, "utf8"));
      if (existingData && existingData.generic) {
        existingGeneric = existingData.generic;
      }
    } catch (e) {
      console.warn("⚠️ Could not parse existing fares.json for generic key:", e.message);
    }
  }

  console.log("🔌 Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB.");

  const db = mongoose.connection.db;
  const fareDocs = await db.collection("fares").find({}).toArray();

  if (!fareDocs || fareDocs.length === 0) {
    console.error("❌ 0 documents found in Mongo fares collection. Aborting migration.");
    await mongoose.disconnect();
    process.exit(1);
  }

  const rawCitiesSet = new Set(fareDocs.map((d) => d.city).filter(Boolean));
  let skippedAvailableFalse = 0;
  const cityGroups = new Map();

  for (const doc of fareDocs) {
    if (doc.available === false) {
      skippedAvailableFalse++;
      continue;
    }

    const rawCity = doc.city ? String(doc.city).trim() : "";
    if (!rawCity) continue;

    const cityKey = rawCity.toLowerCase();
    if (!cityGroups.has(cityKey)) {
      cityGroups.set(cityKey, []);
    }
    cityGroups.get(cityKey).push(doc);
  }

  const resultFares = {};
  const modeCounts = { auto: 0, cab: 0, bus: 0, metro: 0 };
  const skippedNoValidModes = [];

  // Sort city keys alphabetically
  const sortedCityKeys = Array.from(cityGroups.keys()).sort();

  for (const cityKey of sortedCityKeys) {
    const docs = cityGroups.get(cityKey);
    const cityModes = {};

    for (const doc of docs) {
      const mode = doc.mode;
      if (!mode) continue;

      if (mode === "auto") {
        const base = roundVal(doc.baseFare);
        const perKm = roundVal(doc.perKmFare);
        const minFare = roundVal(doc.minFare);
        if (base !== null && perKm !== null && minFare !== null) {
          cityModes.auto = { base, minFare, perKm };
          modeCounts.auto++;
        }
      } else if (mode === "cab") {
        const base = roundVal(doc.baseFare);
        const perKm = roundVal(doc.perKmFare);
        const minFare = roundVal(doc.minFare);
        const perMin = roundVal(doc.perMin) || 2;
        if (base !== null && perKm !== null && minFare !== null) {
          cityModes.cab = { base, minFare, perKm, perMin };
          modeCounts.cab++;
        }
      } else if (mode === "bus") {
        const flatVal = doc.flatFare ?? doc.minFare ?? doc.baseFare;
        const flat = roundVal(flatVal);
        if (flat !== null) {
          cityModes.bus = { flat };
          modeCounts.bus++;
        }
      } else if (mode === "metro") {
        if (Array.isArray(doc.slabs) && doc.slabs.length > 0) {
          cityModes.metro = { slabs: doc.slabs };
          modeCounts.metro++;
        }
      }
    }

    if (Object.keys(cityModes).length === 0) {
      skippedNoValidModes.push(cityKey);
    } else {
      // Sort mode keys inside city object
      const sortedModes = {};
      Object.keys(cityModes)
        .sort()
        .forEach((k) => {
          sortedModes[k] = cityModes[k];
        });
      resultFares[cityKey] = sortedModes;
    }
  }

  // Preserve generic at root
  if (existingGeneric) {
    resultFares.generic = existingGeneric;
  }

  const totalCitiesWithValidModes = Object.keys(resultFares).filter(
    (k) => k !== "generic"
  ).length;

  const jsonContent = JSON.stringify(resultFares, null, 2) + "\n";
  const fileSizeKb = (Buffer.byteLength(jsonContent, "utf8") / 1024).toFixed(1);

  console.log("\nFares migration summary");
  console.log("───────────────────────");
  console.log(`Mongo docs read          : ${fareDocs.length}`);
  console.log(`Unique cities            : ${rawCitiesSet.size}`);
  console.log(`Cities with valid modes  : ${totalCitiesWithValidModes}`);
  console.log(
    `Modes written            : auto=${modeCounts.auto}, cab=${modeCounts.cab}, bus=${modeCounts.bus}, metro=${modeCounts.metro}`
  );
  console.log(`Skipped (available=false): ${skippedAvailableFalse}`);
  console.log(
    `Skipped (no valid modes) : ${skippedNoValidModes.length > 0 ? skippedNoValidModes.join(", ") : "none"}`
  );
  console.log(`generic preserved        : ${existingGeneric ? "yes" : "no"}`);
  console.log(`Sample (ahmedabad)       :`);
  console.log(JSON.stringify(resultFares.ahmedabad || null, null, 2));

  if (isDryRun) {
    console.log(`\nℹ️  [DRY-RUN MODE] Would write ${targetPath} (${fileSizeKb} KB)`);
    await mongoose.disconnect();
    process.exit(0);
  }

  if (!skipConfirm) {
    const answer = await askConfirmation(
      "\n⚠️  Type 'yes' to overwrite backend/src/seeds/fares.json: "
    );
    if (answer.toLowerCase() !== "yes") {
      console.log("Operation cancelled by user.");
      await mongoose.disconnect();
      process.exit(0);
    }
  }

  fs.writeFileSync(targetPath, jsonContent, "utf8");
  console.log(`\n✅ File written             : ${targetPath} (${fileSizeKb} KB)`);

  await mongoose.disconnect();
}

migrateFares().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
