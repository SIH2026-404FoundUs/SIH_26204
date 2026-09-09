import { generateToken, AUTH_COOKIE_OPTIONS } from "../lib/jwt.js";
import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import { validatePasswordPolicy } from "../lib/passwordPolicy.js";
import { issueAuthToken, findValidAuthToken, consumeAuthToken } from "../lib/authTokens.js";
import { sendMail, passwordResetEmail } from "../lib/mailer.js";
import mongoose from "mongoose";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FULLNAME_LEN = 200;
const MAX_EMAIL_LEN = 254; // RFC 5321
const SIGNUP_ROLES = ["traveller", "operator", "authority"];

// The user-facing app's own URL, for links embedded in emails -- distinct
// from CLIENT_URL's role as a CORS allowlist (which may be comma-separated
// for multiple allowed origins); the email always points at the first/primary one.
const APP_URL = (process.env.CLIENT_URL || "http://localhost:5173").split(",")[0].trim();

function validateEmailField(email) {
  if (typeof email !== "string" || !email.trim()) return "Email is required";
  if (email.length > MAX_EMAIL_LEN || !EMAIL_RE.test(email)) return "Please provide a valid email address";
  return null;
}

// ============================================================
// SIGN UP
// ============================================================
// Public signup accepts an explicit role choice (traveller/operator/
// authority) from the signup form. It is still whitelisted against a fixed
// enum here -- never spread from req.body -- and anything outside that enum
// silently falls back to "traveller" rather than erroring, so a malformed or
// missing role can never accidentally grant something broader.
export const signup = async (req, res) => {
  const { fullName, email, password, confirmPassword, phone, preferredLanguage, role } = req.body;
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "Authentication service temporarily unavailable" });
    }
    if (!fullName || !email || !password || !confirmPassword) {
      return res.status(400).json({ message: "fullName, email, password, and confirmPassword are required" });
    }
    if (typeof fullName !== "string" || typeof password !== "string" || typeof confirmPassword !== "string") {
      return res.status(400).json({ message: "fullName and password fields must all be strings" });
    }
    if (!fullName.trim()) {
      return res.status(400).json({ message: "fullName is required" });
    }
    if (fullName.length > MAX_FULLNAME_LEN) {
      return res.status(400).json({ message: `fullName must be ${MAX_FULLNAME_LEN} characters or fewer` });
    }
    const emailError = validateEmailField(email);
    if (emailError) return res.status(400).json({ message: emailError });

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }
    const passwordError = validatePasswordPolicy(password);
    if (passwordError) return res.status(400).json({ message: passwordError });

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: "Email already exists" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Explicit field list, not a spread of req.body -- nothing beyond what's
    // named here can ever land on the document, and `role` is clamped to the
    // fixed enum right at the point of use so a client can never send some
    // fifth string and have it pass straight through to Mongoose.
    const newUser = await User.create({
      fullName: fullName.trim(),
      email,
      passwordHash: hashedPassword,
      role: SIGNUP_ROLES.includes(role) ? role : "traveller",
      phone: typeof phone === "string" ? phone.trim() : undefined,
      preferredLanguage: typeof preferredLanguage === "string" ? preferredLanguage.trim() : undefined,
    });

    // No email verification step -- the account is usable immediately, so
    // signup logs the traveller straight in rather than making them turn
    // around and sign in again with the password they just typed.
    generateToken(newUser._id, newUser.tokenVersion, res);

    res.status(201).json({
      _id: newUser._id,
      fullName: newUser.fullName,
      email: newUser.email,
      role: newUser.role,
    });
  } catch (error) {
    console.log("Error in signup controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// ============================================================
// SIGN IN
// ============================================================
export const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "Authentication service temporarily unavailable" });
    }
    if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password.trim()) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const user = await User.findOne({ email });
    if (!user || !user.passwordHash) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordCorrect) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    generateToken(user._id, user.tokenVersion, res);

    res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    console.log("Error in login controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const logout = (req, res) => {
  try {
    // Match the attributes generateToken() set it with -- a clearing
    // Set-Cookie with a mismatched SameSite/Secure can fail to actually
    // clear a cookie in some browsers.
    res.cookie("jwt", "", { ...AUTH_COOKIE_OPTIONS, maxAge: 0 });
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.log("Error in logout controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const checkAuth = (req, res) => {
  try {
    res.status(200).json(req.user);
  } catch (error) {
    console.log("Error in checkAuth controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// ============================================================
// FORGOT / RESET PASSWORD
// ============================================================
// Always the same response regardless of whether the account exists (spec
// §9/§10: "never reveal whether account exists").
export const forgotPassword = async (req, res) => {
  const GENERIC = { message: "If an account exists for this email, we'll send password reset instructions." };
  try {
    const { email } = req.body;
    if (typeof email !== "string" || !email.trim()) {
      return res.status(200).json(GENERIC);
    }

    const user = await User.findOne({ email });
    if (user) {
      const rawToken = await issueAuthToken(user._id, "password_reset");
      const link = `${APP_URL}/reset-password?token=${rawToken}`;
      try {
        await sendMail({ to: user.email, ...passwordResetEmail(link) });
      } catch (mailError) {
        console.log("Error sending password reset email:", mailError.message);
      }
    }

    res.status(200).json(GENERIC);
  } catch (error) {
    console.log("Error in forgotPassword controller", error.message);
    res.status(200).json(GENERIC);
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;

    const result = await findValidAuthToken(token, "password_reset");
    if (!result.ok) {
      return res.status(400).json({ message: "This reset link is invalid or has expired." });
    }

    if (typeof password !== "string" || typeof confirmPassword !== "string") {
      return res.status(400).json({ message: "password and confirmPassword are required" });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }
    const passwordError = validatePasswordPolicy(password);
    if (passwordError) return res.status(400).json({ message: passwordError });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // $inc tokenVersion -- every JWT issued before this reset (any device,
    // any tab) stops passing protectRoute's check immediately (spec §12
    // step 8: "invalidate existing sessions").
    await User.findByIdAndUpdate(result.doc.userId, {
      $set: { passwordHash: hashedPassword },
      $inc: { tokenVersion: 1 },
    });
    // Single-use: this exact token can never succeed a second time, even
    // against the OLD password (spec §12: "MUST NOT be reusable").
    await consumeAuthToken(result.doc);

    // Deliberately not auto-logging in -- the traveller's own flow diagram
    // (spec §20) goes reset -> /signin, a fresh explicit login with the new
    // password rather than trusting the reset link itself as a session.
    res.status(200).json({ message: "Password reset. Please sign in with your new password." });
  } catch (error) {
    console.log("Error in resetPassword controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// ============================================================
// CHANGE PASSWORD (logged in)
// ============================================================
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;
    if (typeof currentPassword !== "string" || typeof newPassword !== "string" || typeof confirmNewPassword !== "string") {
      return res.status(400).json({ message: "currentPassword, newPassword, and confirmNewPassword are required" });
    }
    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ message: "New passwords do not match" });
    }
    const passwordError = validatePasswordPolicy(newPassword);
    if (passwordError) return res.status(400).json({ message: passwordError });

    // protectRoute's own query excludes passwordHash, so it has to be
    // re-fetched here to verify the current password.
    const user = await User.findById(req.user._id);
    const isCurrentCorrect = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentCorrect) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    user.tokenVersion += 1;
    await user.save();

    // Unlike a reset, the person doing this is already authenticated right
    // now with a correctly-verified current password -- that IS a fresh
    // re-auth, so re-issue a token under the new version so THIS session
    // continues seamlessly. Any OTHER device/tab's older cookie still stops
    // working, which is the actual point of bumping tokenVersion.
    generateToken(user._id, user.tokenVersion, res);

    res.status(200).json({ message: "Password changed." });
  } catch (error) {
    console.log("Error in changePassword controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
