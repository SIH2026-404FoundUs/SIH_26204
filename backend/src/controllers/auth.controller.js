import { generateToken, AUTH_COOKIE_OPTIONS } from "../lib/jwt.js";
import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import { validatePasswordPolicy } from "../lib/passwordPolicy.js";
import { issueAuthToken, findValidAuthToken, consumeAuthToken, findAuthTokenAnyState } from "../lib/authTokens.js";
import { sendMail, verificationEmail, passwordResetEmail } from "../lib/mailer.js";

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

    const rawToken = await issueAuthToken(newUser._id, "email_verify");
    const link = `${APP_URL}/verify-email?token=${rawToken}`;
    try {
      await sendMail({ to: newUser.email, ...verificationEmail(link) });
    } catch (mailError) {
      // The account is real either way -- a mail-provider hiccup shouldn't
      // undo account creation. Logged for operators to notice and the user
      // can always ask for a fresh link via resend-verification.
      console.log("Error sending verification email:", mailError.message);
    }

    // Deliberately NOT logging the user in here -- email verification would
    // be cosmetic otherwise (auth spec: "Do NOT make email verification
    // cosmetic"). No cookie is set; login is blocked until verified.
    res.status(201).json({
      message: "Account created. Check your email for a verification link.",
      email: newUser.email,
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

    if (!user.emailVerified) {
      // A real, distinct reason -- never "Invalid credentials" when the
      // actual issue is verification (auth spec §8: "Do NOT silently fail").
      return res.status(403).json({
        code: "EMAIL_NOT_VERIFIED",
        message: "Please verify your email before signing in.",
      });
    }

    generateToken(user._id, user.tokenVersion, res);

    res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
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
// EMAIL VERIFICATION
// ============================================================
export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;
    const result = await findValidAuthToken(token, "email_verify");

    if (result.ok) {
      await User.findByIdAndUpdate(result.doc.userId, { emailVerified: true });
      await consumeAuthToken(result.doc);
      return res.status(200).json({ status: "verified", message: "Email verified." });
    }

    // A token that was already used successfully is a distinct, friendlier
    // UI state ("already verified") from one that's genuinely bad -- but
    // only when it actually belongs to a now-verified account, not just any
    // used-up row (spec §5, state 4 vs state 3).
    if (result.reason === "used") {
      const tokenDoc = await findAuthTokenAnyState(token, "email_verify");
      if (tokenDoc) {
        const user = await User.findById(tokenDoc.userId).select("emailVerified");
        if (user?.emailVerified) {
          return res.status(200).json({ status: "already_verified", message: "Your email is already verified." });
        }
      }
    }

    return res.status(400).json({
      status: "invalid",
      message: "This verification link is invalid or has expired.",
    });
  } catch (error) {
    console.log("Error in verifyEmail controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// POST /api/auth/resend-verification -- always the same response regardless
// of whether the email exists or is already verified (spec §6: "Prevent
// email enumeration where appropriate").
export const resendVerification = async (req, res) => {
  const GENERIC = { message: "If an account with this email needs verification, we've sent a new link." };
  try {
    const { email } = req.body;
    if (typeof email !== "string" || !email.trim()) {
      return res.status(200).json(GENERIC);
    }

    const user = await User.findOne({ email });
    if (user && !user.emailVerified) {
      const rawToken = await issueAuthToken(user._id, "email_verify");
      const link = `${APP_URL}/verify-email?token=${rawToken}`;
      try {
        await sendMail({ to: user.email, ...verificationEmail(link) });
      } catch (mailError) {
        console.log("Error sending verification email:", mailError.message);
      }
    }

    res.status(200).json(GENERIC);
  } catch (error) {
    console.log("Error in resendVerification controller", error.message);
    // Even on an internal error, don't leak account existence through a
    // different response shape than the happy path.
    res.status(200).json(GENERIC);
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
