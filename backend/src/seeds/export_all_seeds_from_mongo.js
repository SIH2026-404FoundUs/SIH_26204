// Usage:
//   node backend/src/seeds/export_all_seeds_from_mongo.js --dry-run
//   node backend/src/seeds/export_all_seeds_from_mongo.js
//   node backend/src/seeds/export_all_seeds_from_mongo.js --yes

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline";
import mongoose from "mongoose";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../../.env") });

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/tourism_platform";

function askConfirmation(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function cleanDoc(doc, { keepId = true } = {}) {
  const clean = { ...doc };

  if (keepId && clean._id) {
    if (typeof clean._id === "object" && clean._id.toString) {
      clean._id = clean._id.toString();
    }
  } else if (!keepId) {
    delete clean._id;
  }

  delete clean.__v;
  return clean;
}

async function exportAllSeeds() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");
  const skipConfirm = args.includes("--yes");

  console.log("🔍 Preparing full database seed export from MongoDB...");
  if (isDryRun) {
    console.log("ℹ️  [DRY-RUN MODE] No files will be modified or deleted.");
  }

  if (!isDryRun && !skipConfirm) {
    const answer = await askConfirmation(
      "⚠️  This will overwrite existing seed files in backend/src/seeds/. Type 'yes' to proceed: "
    );
    if (answer.toLowerCase() !== "yes") {
      console.log("Operation cancelled by user.");
      process.exit(0);
    }
  }

  const seedsDir = __dirname;
  const destinationsDir = path.join(seedsDir, "destinations");
  let exitCode = 0;

  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB.");

    const db = mongoose.connection.db;

    const summary = [];

    // 1. Export Destinations (special case: multi-file export in destinations/)
    const destDocs = await db.collection("destinations").find({}).toArray();
    if (!destDocs || destDocs.length === 0) {
      console.warn("⚠️  [destinations] 0 documents found in MongoDB collection. Skipping destinations export.");
      summary.push({ name: "destinations", text: "0 docs → skipped" });
    } else {
      const illegalCharsRegex = /[\\/:*?"<>|]/;
      const seenIds = new Set();
      let valid = true;

      for (let i = 0; i < destDocs.length; i++) {
        const doc = destDocs[i];
        if (!doc || !("_id" in doc) || doc._id === null || doc._id === undefined) {
          console.error(`❌ [destinations] Document at index ${i} missing '_id'.`);
          valid = false;
          break;
        }
        const idVal = typeof doc._id === "object" && doc._id.toString ? doc._id.toString() : String(doc._id);
        if (!idVal || illegalCharsRegex.test(idVal)) {
          console.error(`❌ [destinations] Document index ${i} has invalid/illegal _id '${idVal}'.`);
          valid = false;
          break;
        }
        if (seenIds.has(idVal)) {
          console.error(`❌ [destinations] Duplicate _id '${idVal}' found.`);
          valid = false;
          break;
        }
        seenIds.add(idVal);
      }

      if (!valid) {
        exitCode = 1;
        return;
      }

      const existingDestFiles = fs.existsSync(destinationsDir)
        ? fs.readdirSync(destinationsDir).filter((f) => f.endsWith(".json"))
        : [];

      if (!isDryRun) {
        if (!fs.existsSync(destinationsDir)) {
          fs.mkdirSync(destinationsDir, { recursive: true });
        }
        for (const file of existingDestFiles) {
          fs.unlinkSync(path.join(destinationsDir, file));
        }
        for (const doc of destDocs) {
          const idVal = typeof doc._id === "object" && doc._id.toString ? doc._id.toString() : String(doc._id);
          const cleaned = cleanDoc(doc, { keepId: true });
          fs.writeFileSync(path.join(destinationsDir, `${idVal}.json`), JSON.stringify(cleaned, null, 2) + "\n", "utf-8");
        }
      }
      summary.push({ name: "destinations", text: `${destDocs.length} docs → ${destDocs.length} files in destinations/` });
    }

    // 2. Export Businesses -> businesses.json
    const bizDocs = await db.collection("businesses").find({}).toArray();
    if (!bizDocs || bizDocs.length === 0) {
      console.warn("⚠️  [businesses] 0 documents found. Skipping businesses.json update.");
      summary.push({ name: "businesses", text: "0 docs → skipped" });
    } else {
      if (!isDryRun) {
        const cleanedArr = bizDocs.map((d) => cleanDoc(d, { keepId: true }));
        fs.writeFileSync(path.join(seedsDir, "businesses.json"), JSON.stringify(cleanedArr, null, 2) + "\n", "utf-8");
      }
      summary.push({ name: "businesses", text: `${bizDocs.length} docs → businesses.json` });
    }

    // 3. Export Business Availabilities -> availability.json
    const availDocs = await db.collection("business_availabilities").find({}).toArray();
    if (!availDocs || availDocs.length === 0) {
      console.warn("⚠️  [availability] 0 documents found. Skipping availability.json update.");
      summary.push({ name: "availability", text: "0 docs → skipped" });
    } else {
      if (!isDryRun) {
        const cleanedArr = availDocs.map((d) => cleanDoc(d, { keepId: true }));
        fs.writeFileSync(path.join(seedsDir, "availability.json"), JSON.stringify(cleanedArr, null, 2) + "\n", "utf-8");
      }
      summary.push({ name: "availability", text: `${availDocs.length} docs → availability.json` });
    }

    // 4. Export Calendar -> calendar.json (calendar rows do not carry _id on disk)
    const calDocs = await db.collection("calendar").find({}).toArray();
    if (!calDocs || calDocs.length === 0) {
      console.warn("⚠️  [calendars] 0 documents found in 'calendar' collection. Skipping calendar.json update.");
      summary.push({ name: "calendars", text: "0 docs → skipped" });
    } else {
      if (!isDryRun) {
        const cleanedArr = calDocs.map((d) => cleanDoc(d, { keepId: false }));
        fs.writeFileSync(path.join(seedsDir, "calendar.json"), JSON.stringify(cleanedArr, null, 2) + "\n", "utf-8");
      }
      summary.push({ name: "calendars", text: `${calDocs.length} docs → calendar.json` });
    }

    // Note: destination_pressures / pressure_history.json is explicitly untouched per prompt instructions
    summary.push({ name: "pressure_history", text: "skipped (untouched per instructions)" });

    console.log("\n==============================================");
    console.log("📊 EXPORT ALL SEEDS SUMMARY");
    console.log("==============================================");
    console.log(`• Mongo connection : OK`);
    for (const s of summary) {
      console.log(`• ${s.name.padEnd(17)} : ${s.text}`);
    }
    console.log("==============================================");

    if (isDryRun) {
      console.log("🚀 Dry-run completed successfully!");
    } else {
      console.log("🚀 All seed collections exported successfully!");
    }
  } catch (err) {
    console.error("❌ Seed export failed with error:", err.message);
    exitCode = 1;
  } finally {
    await mongoose.disconnect();
    process.exit(exitCode);
  }
}

exportAllSeeds();
