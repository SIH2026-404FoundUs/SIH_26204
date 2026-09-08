import mongoose from "mongoose";

// auth_tokens — single-use, time-limited tokens for email verification and
// password reset (auth spec §4, §10). Only ever stores a SHA-256 hash of the
// actual token, never the raw value -- a database read (backup, leaked
// snapshot, a stray console.log) must never hand out something usable.
// The raw token exists only in memory for the moment it's generated and in
// the URL sent to the user.
const authTokenSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    purpose: { type: String, enum: ["email_verify", "password_reset"], required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

authTokenSchema.index({ userId: 1, purpose: 1 });
// Mongo reaps expired rows on its own once they're 1h past expiry -- a
// generous grace window past expiresAt so a "this link expired" response is
// still possible right up until then, rather than the row vanishing exactly
// at expiry and turning an honest "expired" into a less honest "not found".
authTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 60 * 60 });

const AuthToken = mongoose.model("AuthToken", authTokenSchema, "auth_tokens");
export default AuthToken;
