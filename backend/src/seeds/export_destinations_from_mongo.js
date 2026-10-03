// Usage:
//   node backend/src/seeds/export_destinations_from_mongo.js --dry-run
//   node backend/src/seeds/export_destinations_from_mongo.js
//   node backend/src/seeds/export_destinations_from_mongo.js --yes

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { askConfirmation, cleanDoc } from "./_lib/cliPrompt.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../../.env") });

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/tourism_platform";

async function exportDestinations() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");
  const skipConfirm = args.includes("--yes");

  console.log("🔍 Preparing destination export from MongoDB...");
  if (isDryRun) {
    console.log("ℹ️  [DRY-RUN MODE] No files will be modified or deleted.");
  }

  if (!isDryRun && !skipConfirm) {
    const answer = await askConfirmation(
      "⚠️  This will delete all existing JSON files in backend/src/seeds/destinations/ and replace them with MongoDB records.\nType 'yes' to proceed: "
    );
    if (answer.toLowerCase() !== "yes") {
      console.log("Operation cancelled by user.");
      process.exit(0);
    }
  }

  const destinationsDir = path.join(__dirname, "destinations");
  let exitCode = 0;

  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB.");

    const db = mongoose.connection.db;
    const docs = await db.collection("destinations").find({}).toArray();

    if (!docs || docs.length === 0) {
      console.error("⚠️  No documents found in destinations collection (or collection is empty).");
      console.error("Aborting export to prevent wiping local seed files.");
      exitCode = 1;
      return;
    }

    // ID field is strictly doc._id
    const idKey = "_id";
    const illegalCharsRegex = /[\\/:*?"<>|]/;

    console.log(`🔑 ID field chosen: '${idKey}'`);

    // Validate all documents have _id, no illegal filename characters, and check for duplicates
    const seenIds = new Set();
    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      if (!doc || !("_id" in doc) || doc._id === null || doc._id === undefined) {
        console.error(`❌ Document at index ${i} is missing the '_id' field.`);
        exitCode = 1;
        return;
      }

      const rawId = doc._id;
      const idVal = (rawId && typeof rawId === "object" && rawId.toString) ? rawId.toString() : String(rawId);

      if (!idVal) {
        console.error(`❌ Document at index ${i} has an empty '_id' field.`);
        exitCode = 1;
        return;
      }

      if (illegalCharsRegex.test(idVal)) {
        console.error(`❌ Document at index ${i} has _id '${idVal}' containing illegal filesystem characters.`);
        exitCode = 1;
        return;
      }

      if (seenIds.has(idVal)) {
        console.error(`❌ Duplicate _id '${idVal}' found at index ${i}. All destination IDs must be unique.`);
        exitCode = 1;
        return;
      }
      seenIds.add(idVal);
    }

    const existingFiles = fs.readdirSync(destinationsDir).filter((f) => f.endsWith(".json"));
    console.log(`📁 Found ${existingFiles.length} existing .json files in backend/src/seeds/destinations/`);

    if (!isDryRun) {
      console.log("Deleting existing .json files in destination seed directory...");
      for (const file of existingFiles) {
        fs.unlinkSync(path.join(destinationsDir, file));
      }
      console.log(`✅ Deleted ${existingFiles.length} existing .json files.`);
    } else {
      console.log(`[DRY-RUN] Would delete ${existingFiles.length} existing .json files.`);
    }

    let writtenCount = 0;
    let sampleFilename = "";

    for (const doc of docs) {
      const rawId = doc._id;
      const idVal = (rawId && typeof rawId === "object" && rawId.toString) ? rawId.toString() : String(rawId);
      const filename = `${idVal}.json`;
      const filePath = path.join(destinationsDir, filename);

      if (!sampleFilename) {
        sampleFilename = filename;
      }

      const cleanedDoc = cleanDoc(doc);
      const jsonContent = JSON.stringify(cleanedDoc, null, 2) + "\n";

      if (!isDryRun) {
        fs.writeFileSync(filePath, jsonContent, "utf-8");
      }
      writtenCount++;
    }

    if (!isDryRun) {
      const writtenFiles = fs.readdirSync(destinationsDir).filter((f) => f.endsWith(".json"));
      if (writtenFiles.length !== docs.length) {
        console.error(`⚠️  Verification mismatch! Expected ${docs.length} files, but found ${writtenFiles.length} on disk.`);
        exitCode = 1;
        return;
      }
      console.log(`✅ Verification passed: ${writtenFiles.length} files written match ${docs.length} MongoDB documents.`);
    }

    console.log("\n==============================================");
    console.log("📊 EXPORT SUMMARY");
    console.log("==============================================");
    console.log(`• Mongo doc count  : ${docs.length}`);
    console.log(`• ID field chosen  : '${idKey}'`);
    console.log(`• Files deleted    : ${isDryRun ? 0 : existingFiles.length} (Dry-run would delete: ${existingFiles.length})`);
    console.log(`• Files written    : ${writtenCount} ${isDryRun ? "(dry-run)" : ""}`);
    console.log(`• Sample filename  : ${sampleFilename}`);
    console.log("==============================================");
    if (!isDryRun) {
      console.log("🚀 Destination export completed successfully!");
    } else {
      console.log("🚀 Dry-run completed successfully!");
    }
  } catch (err) {
    console.error("❌ Export failed with error:", err.message);
    exitCode = 1;
  } finally {
    await mongoose.disconnect();
    process.exit(exitCode);
  }
}

exportDestinations();
