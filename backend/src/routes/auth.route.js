import express from "express";
import {
  checkAuth, login, logout, signup,
  verifyEmail, resendVerification,
  forgotPassword, resetPassword, changePassword,
} from "../controllers/auth.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  signupLimiter, loginLimiter, forgotPasswordLimiter, resetPasswordLimiter,
  verifyEmailLimiter, resendVerificationLimiter,
} from "../middleware/authRateLimit.js";

const router = express.Router();

router.post("/signup", signupLimiter, signup);
router.post("/login", loginLimiter, login);
router.post("/logout", logout);

router.get("/check", protectRoute, checkAuth);

router.post("/verify-email", verifyEmailLimiter, verifyEmail);
router.post("/resend-verification", resendVerificationLimiter, resendVerification);

router.post("/forgot-password", forgotPasswordLimiter, forgotPassword);
router.post("/reset-password", resetPasswordLimiter, resetPassword);

router.patch("/change-password", protectRoute, changePassword);

export default router;
