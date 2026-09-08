import rateLimit from "express-rate-limit";

// Auth spec §15: rate-limit these without permanently locking out a
// legitimate user who fat-fingered their password a couple of times. These
// are per-IP windows, not per-account bans -- generous enough that a real
// user retrying a typo never notices, tight enough that a brute-force script
// does.
const make = (windowMinutes, max, message) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message },
  });

export const signupLimiter = make(60, 10, "Too many accounts created from this network. Please try again later.");
export const loginLimiter = make(15, 15, "Too many sign-in attempts. Please wait a few minutes and try again.");
export const forgotPasswordLimiter = make(60, 5, "Too many password reset requests. Please try again later.");
export const resetPasswordLimiter = make(60, 10, "Too many password reset attempts. Please try again later.");
export const verifyEmailLimiter = make(60, 10, "Too many verification attempts. Please try again later.");
export const resendVerificationLimiter = make(60, 5, "Too many verification emails requested. Please try again later.");
