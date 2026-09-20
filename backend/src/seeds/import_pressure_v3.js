// backend/src/seeds/import_pressure_v3.js
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mongoose from "mongoose";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../../.env") });

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/tourism_platform";

const WEIGHTS = {
  demand: 0.3059,
  access: 0.2135,
  stay: 0.2136,
  calendar: 0.1068,
  weather: 0.1068,
  capacity: 0.0534,
};

function parseCsvLine(line) {
  return line.split(",").map((s) => s.trim());
}

async function readCsvFile(filename) {
  const filePath = path.join(__dirname, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`CSV file not found: ${filePath}`);
  }

  const fileStream = fs.createReadStream(filePath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  const rows = [];
  let header = null;

  for await (const line of rl) {
    if (!line || !line.trim()) continue;
    const parts = parseCsvLine(line);
    if (!header) {
      header = parts;
      continue;
    }

    const destId = parts[0];
    const date = parts[1];
    const score = parseFloat(parts[2]);
    const confidence = parseFloat(parts[5]);
    const predictedVisitors = parseFloat(parts[6]);
    const baselineVisitors = parseFloat(parts[7]);
    const demandRatio = parseFloat(parts[8]);

    const demandVal = parseFloat(parts[9]);
    const accessVal = parseFloat(parts[10]);
    const stayVal = parseFloat(parts[11]);
    const calVal = parseFloat(parts[12]);
    const wxVal = parseFloat(parts[13]);
    const capVal = parseFloat(parts[14]);

    const demandSrc = parts[15] || "ml_causal";
    const accessSrc = parts[16] || "provider_climatology";
    const staySrc = parts[17] || "provider_climatology";
    const calSrc = parts[18] || "holiday_calendar";
    const wxSrc = parts[19] || "provider_climatology";
    const capSrc = parts[20] || "seed";

    const droppedRaw = parts[23];
    const degradedRaw = parts[24];

    const dropped = droppedRaw ? droppedRaw.split("|").filter(Boolean) : [];
    const degraded = degradedRaw ? degradedRaw.split("|").filter(Boolean) : [];

    const is2026 = date.startsWith("2026");

    const doc = {
      _id: `${destId}_${date}`,
      destId,
      date,
      score: Number.isNaN(score) ? null : Math.round(score * 10000) / 10000,
      components: {
        demand: {
          value: Number.isNaN(demandVal) ? null : Math.round(demandVal * 10000) / 10000,
          weight: WEIGHTS.demand,
          source: demandSrc,
          predictedVisitors: Number.isNaN(predictedVisitors) ? null : predictedVisitors,
          baselineVisitors: Number.isNaN(baselineVisitors) ? null : baselineVisitors,
          demandRatio: Number.isNaN(demandRatio) ? null : Math.round(demandRatio * 10000) / 10000,
        },
        access: {
          value: Number.isNaN(accessVal) ? null : Math.round(accessVal * 10000) / 10000,
          weight: WEIGHTS.access,
          source: accessSrc,
        },
        stay: {
          value: Number.isNaN(stayVal) ? null : Math.round(stayVal * 10000) / 10000,
          weight: WEIGHTS.stay,
          source: staySrc,
        },
        calendar: {
          value: Number.isNaN(calVal) ? null : Math.round(calVal * 10000) / 10000,
          weight: WEIGHTS.calendar,
          source: calSrc,
        },
        weather: {
          value: Number.isNaN(wxVal) ? null : Math.round(wxVal * 10000) / 10000,
          weight: WEIGHTS.weather,
          source: wxSrc,
        },
        capacity: {
          value: Number.isNaN(capVal) ? null : Math.round(capVal * 10000) / 10000,
          weight: WEIGHTS.capacity,
          source: capSrc,
        },
      },
      dateVaryingSubtotal: 0.95,
      staticSubtotal: 0.05,
      dropped,
      degraded,
      lowConfidence: confidence < 0.5,
      stale: is2026,
      formulaVersion: 3,
      computedAt: new Date(),
    };

    rows.push(doc);
  }

  return rows;
}

async function run() {
  const isDryRun = process.argv.includes("--dry-run");
  const isYes = process.argv.includes("--yes");

  if (!isDryRun && !isYes) {
    console.log("Usage: node import_pressure_v3.js [--dry-run | --yes]");
    process.exit(1);
  }

  console.log("🚀 Starting Pressure History v3 Import...");
  const start = Date.now();

  const h3Rows = await readCsvFile("pressure_history_v3.csv");
  console.log(`[CSV] Read ${h3Rows.length} rows from pressure_history_v3.csv`);

  const p26Rows = await readCsvFile("pressure_projection_2026.csv");
  console.log(`[CSV] Read ${p26Rows.length} rows from pressure_projection_2026.csv`);

  const allRows = [...h3Rows, ...p26Rows];
  console.log(`[CSV] Total combined rows: ${allRows.length}`);

  const jsonPath = path.join(__dirname, "pressure_history.json");
  fs.writeFileSync(jsonPath, JSON.stringify(allRows, null, 2), "utf8");
  console.log(`💾 Overwrote ${jsonPath} on disk (${allRows.length} documents)`);

  if (isDryRun) {
    console.log("\n🔍 DRY-RUN SUMMARY:");
    console.log(`- Combined Docs: ${allRows.length}`);
    console.log(`- Sample Doc Shimla 2026-12-26:`);
    const sample = allRows.find((r) => r.destId === "shimla" && r.date === "2026-12-26");
    console.log(JSON.stringify(sample, null, 2));
    console.log("✅ Dry-run complete. No database changes were made.");
    process.exit(0);
  }

  console.log(`\n🔌 Connecting to MongoDB at ${MONGODB_URI}...`);
  await mongoose.connect(MONGODB_URI);

  const db = mongoose.connection.db;
  const col = db.collection("destination_pressures");

  console.log("🗑️ Clearing existing destination_pressures collection...");
  await col.deleteMany({});

  console.log("📥 Inserting documents in batches of 5000...");
  const BATCH_SIZE = 5000;
  for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
    const batch = allRows.slice(i, i + BATCH_SIZE);
    await col.insertMany(batch);
    console.log(`   Inserted ${Math.min(i + BATCH_SIZE, allRows.length)} / ${allRows.length}`);
  }

  const finalCount = await col.countDocuments();
  console.log(`\n✅ MongoDB Import Complete! Document count: ${finalCount}`);

  const verifyDoc = await col.findOne({ destId: "shimla", date: "2026-12-26" });
  console.log("\n📄 Verification Doc (shimla, 2026-12-26):");
  console.log(JSON.stringify(verifyDoc, null, 2));

  await mongoose.disconnect();
  console.log(`🎉 Finished in ${(Date.now() - start) / 1000}s`);
}

run().catch((err) => {
  console.error("❌ Import failed:", err);
  process.exit(1);
});
