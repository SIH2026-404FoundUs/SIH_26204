import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import compression from "compression";
import dns from "dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);
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
import onboardingRoutes from "./routes/onboarding.route.js";
import whatsappWebhookRoutes from "./routes/whatsappWebhook.route.js";
import geocodeRoutes from "./routes/geocode.route.js";
import alternativesRoutes from "./routes/alternatives.route.js";
import visitsRoutes from "./routes/visits.route.js";
import communityRoutes from "./routes/community.route.js";
import offersRoutes from "./routes/offers.route.js";
import waitlistRoutes from "./routes/waitlist.route.js";
import alertsRoutes from "./routes/alerts.route.js";
import businessesRoutes from "./routes/businesses.route.js";
import usersRoutes from "./routes/users.route.js";
import safetyRoutes from "./routes/safety.route.js";
import tripsRoutes from "./routes/trips.route.js";
import dashboardRoutes from "./routes/dashboard.route.js";
import destinationsRoutes from "./routes/destinations.route.js";
import bookingsRoutes from "./routes/bookings.route.js";
import analyticsRoutes from "./routes/analytics.route.js";
import contentRoutes from "./routes/content.route.js";
import feedbackRoutes from "./routes/feedback.route.js";
import revenueRoutes from "./routes/revenue.route.js";
import workersRoutes from "./routes/workers.route.js";
import gigsRoutes from "./routes/gigs.route.js";
import operatorsRoutes from "./routes/operators.route.js";
import travelTypesRoutes from "./routes/travelTypes.route.js";
import educationRoutes from "./routes/education.route.js";
import groupTripsRoutes from "./routes/groupTrips.route.js";
import broadcastAlertsRoutes from "./routes/broadcastAlerts.route.js";
import { startAlertPolling } from "./jobs/scheduler.js";

// dotenv.config() with no path loads .env from process.cwd(), which silently
// finds nothing (MONGODB_URI etc. come back undefined) if the server is started
// from the repo root instead of backend/. Load backend/.env explicitly so
// `node backend/src/index.js` works the same from either directory.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const app = express();

// Render (and most PaaS hosts) terminate TLS at a reverse proxy and forward
// the real client IP via X-Forwarded-For. Without this, express-rate-limit
// resolves every request to the proxy's own IP -- collapsing signup/login
// rate limits onto one shared bucket for all users -- and newer versions of
// express-rate-limit throw a validation error outright when they see
// X-Forwarded-For with trust proxy left at Express's default (false). "1"
// trusts exactly the first hop (the platform's own proxy), not an
// arbitrary client-supplied header.
app.set("trust proxy", 1);

const PORT = process.env.PORT || 5000;

// gzip/brotli every response -- the single highest-leverage low-bandwidth
// change available: shrinks every JSON payload and static asset the same
// way regardless of which endpoint or screen sent it, before any of the
// more targeted per-endpoint work below.
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

// CLIENT_URL may be a single deployed frontend URL or a comma-separated list
// (e.g. the production Vercel URL plus localhost, for testing a deployed
// backend from a local frontend) -- one env var covers both single- and
// multi-origin deployments without needing a second config knob.
const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: (origin, callback) => {
      // No Origin header at all (curl, server-to-server, health checks) --
      // let it through; credentialed browser requests always send Origin,
      // so this can't be used to smuggle a cross-site cookie read.
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  })
);

// Render's health check (and anyone's uptime monitor) needs a route that
// doesn't depend on Mongo being connected.
app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/v1/budget", budgetRoutes);
app.use("/api/v1/pressure", pressureRoutes);
app.use("/api/weather", weatherRoutes);
app.use("/api/trains", trainsRoutes);
app.use("/api/places", placesRoutes);
app.use("/api/routes", routesRoutes);
app.use("/api/destinations", destinationsRoutes);
app.use("/api/fare", fareRoutes);
app.use("/api/road", roadRoutes);
app.use("/api/internal/onboarding", onboardingRoutes);
app.use("/api/webhook/whatsapp", whatsappWebhookRoutes);
app.use("/api/geocode", geocodeRoutes);
app.use("/api/alternatives", alternativesRoutes);
app.use("/api/v1/visits", visitsRoutes);
app.use("/api/community", communityRoutes); // spec §3.1 literally: "POST /community/submissions"
app.use("/api/v1/offers", offersRoutes);
app.use("/api/v1/waitlist", waitlistRoutes);
app.use("/api/v1/alerts", alertsRoutes);
app.use("/api/v1/businesses", businessesRoutes);
app.use("/api/v1/bookings", bookingsRoutes);
app.use("/api/v1/analytics", analyticsRoutes);
app.use("/api/v1/users", usersRoutes);
app.use("/api/v1/safety", safetyRoutes);
app.use("/api/v1/trips", tripsRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/content", contentRoutes); // Tourism Publicity Generator -- operator-only
app.use("/api/v1/feedback", feedbackRoutes); // AI Tourist Feedback Intelligence
app.use("/api/v1/revenue", revenueRoutes); // Operator Revenue Management System, operator-only
app.use("/api/v1/workers", workersRoutes); // Worker role -- worker-only
app.use("/api/v1/gigs", gigsRoutes); // Worker role -- gig post/browse/accept/complete/rate
app.use("/api/v1/operators", operatorsRoutes); // Worker role -- operator's own posted-gig tracking
app.use("/api/v1/travel-types", travelTypesRoutes); // Travel Types taxonomy (Revised Implementation Plan §6)
app.use("/api/v1/destinations", educationRoutes); // Travel Education, keyed on the canonical destId (§8/§9) -- distinct base path from /api/destinations (the file-seeded list) since this is Mongo-backed content, mounted where the plan's API list (§18) put it
app.use("/api/v1/group-trips", groupTripsRoutes); // Group Travel core lifecycle (§10-13)
app.use("/api/v1/broadcast-alerts", broadcastAlertsRoutes); // authority emergency broadcast, every account

app.listen(PORT, () => {
  console.log("server is running on PORT:" + PORT);
  connectDB().then(() => startAlertPolling());
});

