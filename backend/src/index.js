import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import { connectDB } from "./lib/db.js";
import authRoutes from "./routes/auth.route.js";
import budgetRoutes from "./routes/budget.routes.js";

dotenv.config();
console.log("DEBUG URI:", JSON.stringify(process.env.MONGODB_URI));
console.log("DEBUG URI LENGTH:", process.env.MONGODB_URI?.length);
const app = express()

const PORT = process.env.PORT

app.use(express.json());
app.use(cookieParser());
app.use(
  cors('*')
);

app.use("/api/auth", authRoutes);
app.use("/api/v1/budget", budgetRoutes);



app.listen(PORT, () => {
  console.log("server is running on PORT:" + PORT);
  connectDB();
});