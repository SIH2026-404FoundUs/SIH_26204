import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import { connectDB } from "./lib/db.js";
import authRoutes from "./routes/auth.route.js";
import weatherRoutes from "./routes/weather.route.js";
import trainsRoutes from "./routes/trains.route.js";
import placesRoutes from "./routes/places.route.js";
import routesRoutes from "./routes/routes.route.js";
import fareRoutes from "./routes/fare.route.js";
import roadRoutes from "./routes/road.route.js";

dotenv.config();

const app=express()

const PORT = process.env.PORT || 5000

app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/weather", weatherRoutes);
app.use("/api/trains", trainsRoutes);
app.use("/api/places", placesRoutes);
app.use("/api/routes", routesRoutes);
app.use("/api/fare", fareRoutes);
app.use("/api/road", roadRoutes);



app.listen(PORT, () => {
  console.log("server is running on PORT:" + PORT);
  connectDB();
});
