import express from "express";
import {
  checkAuth, login, logout, signup,
  forgotPassword, resetPassword, changePassword, updateProfile,
} from "../controllers/auth.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  signupLimiter, loginLimiter, forgotPasswordLimiter, resetPasswordLimiter,
} from "../middleware/authRateLimit.js";

const router = express.Router();

router.post("/signup", signupLimiter, signup);
router.post("/login", loginLimiter, login);
router.post("/logout", logout);

router.get("/check", protectRoute, checkAuth);

router.post("/forgot-password", forgotPasswordLimiter, forgotPassword);
router.post("/reset-password", resetPasswordLimiter, resetPassword);

router.patch("/change-password", protectRoute, changePassword);
router.put("/update-profile", protectRoute, updateProfile);

export default router;
