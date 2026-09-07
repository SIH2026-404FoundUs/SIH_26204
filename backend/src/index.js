import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import { connectDB } from "./lib/db.js";
import authRoutes from "./routes/auth.route.js";
import budgetRoutes from "./routes/budget.routes.js";
import pressureRoutes from "./routes/pressure.route.js";
import weatherRoutes from "./routes/weather.route.js";
import trainsRoutes from "./routes/trains.route.js";
import placesRoutes from "./routes/places.route.js";
import routesRoutes from "./routes/routes.route.js";
import fareRoutes from "./routes/fare.route.js";
import roadRoutes from "./routes/road.route.js";
import geocodeRoutes from "./routes/geocode.route.js";
import alternativesRoutes from "./routes/alternatives.route.js";
import visitsRoutes from "./routes/visits.route.js";
import communityRoutes from "./routes/community.route.js";
import offersRoutes from "./routes/offers.route.js";
import waitlistRoutes from "./routes/waitlist.route.js";
import alertsRoutes from "./routes/alerts.route.js";

// dotenv.config() with no path loads .env from process.cwd(), which silently
// finds nothing (MONGODB_URI etc. come back undefined) if the server is started
// from the repo root instead of backend/. Load backend/.env explicitly so
// `node backend/src/index.js` works the same from either directory.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const app = express();

const PORT = process.env.PORT || 5000;

app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/v1/budget", budgetRoutes);
app.use("/api/v1/pressure", pressureRoutes);
app.use("/api/weather", weatherRoutes);
app.use("/api/trains", trainsRoutes);
app.use("/api/places", placesRoutes);
app.use("/api/routes", routesRoutes);
app.use("/api/fare", fareRoutes);
app.use("/api/road", roadRoutes);
app.use("/api/geocode", geocodeRoutes);
app.use("/api/alternatives", alternativesRoutes);
app.use("/api/v1/visits", visitsRoutes);
app.use("/api/community", communityRoutes); // spec §3.1 literally: "POST /community/submissions"
app.use("/api/v1/offers", offersRoutes);
app.use("/api/v1/waitlist", waitlistRoutes);
app.use("/api/v1/alerts", alertsRoutes);

app.listen(PORT, () => {
  console.log("server is running on PORT:" + PORT);
  connectDB();
});
