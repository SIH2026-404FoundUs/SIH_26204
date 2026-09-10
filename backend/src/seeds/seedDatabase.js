import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// dotenv.config() with no path loads .env from process.cwd(), which silently
// finds nothing (and falls back to localhost) if this script is run from the
// repo root instead of backend/. Load backend/.env explicitly so the command
// works the same regardless of the caller's working directory.
dotenv.config({ path: path.join(__dirname, "../../.env") });

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/tourism_platform";

async function loadSeedData() {
  const destinationsDir = path.join(__dirname, "destinations");
  const destFiles = fs.readdirSync(destinationsDir).filter(f => f.endsWith(".json"));
  
  const destinations = destFiles.map(file => {
    const content = fs.readFileSync(path.join(destinationsDir, file), "utf-8");
    return JSON.parse(content);
  });

  const businesses = JSON.parse(fs.readFileSync(path.join(__dirname, "businesses.json"), "utf-8"));
  const availability = JSON.parse(fs.readFileSync(path.join(__dirname, "availability.json"), "utf-8"));
  const pressureHistory = JSON.parse(fs.readFileSync(path.join(__dirname, "pressure_history.json"), "utf-8"));
  const calendar = JSON.parse(fs.readFileSync(path.join(__dirname, "calendar.json"), "utf-8"));
  const fares = JSON.parse(fs.readFileSync(path.join(__dirname, "fares.json"), "utf-8"));

  console.log(`Loaded ${destinations.length} destinations.`);
  console.log(`Loaded ${businesses.length} businesses.`);
  console.log(`Loaded ${availability.length} availability records.`);
  console.log(`Loaded ${pressureHistory.length} pressure history records.`);
  console.log(`Loaded ${calendar.length} calendar events.`);
  console.log(`Loaded fare keys: ${Object.keys(fares).join(", ")}`);

  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB.");

    const db = mongoose.connection.db;

    // Seed Destinations
    const destCol = db.collection("destinations");
    await destCol.deleteMany({ trackingTier: "tracked" });
    await destCol.insertMany(destinations);
    console.log("✅ Destinations collection seeded successfully.");

    // Seed Businesses
    const bizCol = db.collection("businesses");
    await bizCol.deleteMany({ onboardedVia: "seed" });
    await bizCol.insertMany(businesses);
    console.log("✅ Businesses collection seeded successfully.");

    // Seed Availability
    const availCol = db.collection("business_availabilities");
    await availCol.deleteMany({ source: "business_declared" });
    await availCol.insertMany(availability);
    console.log("✅ Business Availabilities collection seeded successfully.");

    // Seed Pressure History
    const pressCol = db.collection("destination_pressures");
    await pressCol.deleteMany({});
    await pressCol.insertMany(pressureHistory);
    console.log("✅ Destination Pressures collection seeded successfully.");

    // Seed Calendar
    const calCol = db.collection("calendars");
    await calCol.deleteMany({});
    await calCol.insertMany(calendar);
    console.log("✅ Calendar collection seeded successfully.");

    // Seed Fares
    const fareCol = db.collection("fares");
    await fareCol.deleteMany({});
    await fareCol.insertOne({ _id: "fares_config", data: fares });
    console.log("✅ Fares collection seeded successfully.");

    console.log("🚀 Stage 0 Database Seeding Completed!");
  } catch (err) {
    console.error("MongoDB seeding warning (Connection issue or local setup needed):", err.message);
    console.log("JSON Seed files are intact and ready in backend/src/seeds/");
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

loadSeedData();
