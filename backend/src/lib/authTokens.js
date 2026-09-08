import crypto from "crypto";
import AuthToken from "../models/authToken.model.js";

const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1h -- shorter, since a leaked reset link is more dangerous than a leaked verify link

const TTL_BY_PURPOSE = {
  email_verify: EMAIL_VERIFY_TTL_MS,
  password_reset: PASSWORD_RESET_TTL_MS,
};

const hash = (raw) => crypto.createHash("sha256").update(raw).digest("hex");

/**
 * Create a new single-use token for a purpose, invalidating any previous
 * still-usable token of the same purpose for that user first (auth spec
 * §6/§10: "invalidate previous token where appropriate") -- otherwise an old
 * link stays valid alongside a freshly requested one.
 *
 * @returns {Promise<string>} the RAW token -- put this in the email link.
 *   Only its hash is ever persisted.
 */
export async function issueAuthToken(userId, purpose) {
  await AuthToken.updateMany(
    { userId: String(userId), purpose, usedAt: null },
    { $set: { usedAt: new Date() } } // "used" is a slight abuse of the field here, but it's the same effect: this row can never succeed a verify again
  );

  const raw = crypto.randomBytes(32).toString("hex");
  await AuthToken.create({
    userId: String(userId),
    purpose,
    tokenHash: hash(raw),
    expiresAt: new Date(Date.now() + TTL_BY_PURPOSE[purpose]),
  });
  return raw;
}

/**
 * Look up a raw token for a purpose. Returns the token document if it's
 * valid (exists, right purpose, not expired, not already used), or a reason
 * code if not -- never throws, since "token invalid" is an expected,
 * routine outcome, not a fault.
 *
 * @returns {Promise<{ ok: true, doc: object } | { ok: false, reason: "not_found"|"expired"|"used" }>}
 */
export async function findValidAuthToken(rawToken, purpose) {
  if (!rawToken || typeof rawToken !== "string") return { ok: false, reason: "not_found" };
  const doc = await AuthToken.findOne({ tokenHash: hash(rawToken), purpose });
  if (!doc) return { ok: false, reason: "not_found" };
  if (doc.usedAt) return { ok: false, reason: "used" };
  if (doc.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired" };
  return { ok: true, doc };
}

/** Marks a token consumed. Call this the moment its one legitimate use completes. */
export async function consumeAuthToken(tokenDoc) {
  await AuthToken.updateOne({ _id: tokenDoc._id }, { $set: { usedAt: new Date() } });
}

/**
 * Look up a token regardless of its used/expired state -- only for
 * distinguishing "this link was already used to verify this exact account"
 * (a real, distinct UI state per auth spec §5: "Already verified") from a
 * genuinely invalid/expired token. Never use this for the actual
 * verify/reset action -- findValidAuthToken() is the one that enforces the
 * single-use/expiry rules.
 */
export async function findAuthTokenAnyState(rawToken, purpose) {
  if (!rawToken || typeof rawToken !== "string") return null;
  return AuthToken.findOne({ tokenHash: hash(rawToken), purpose });
}
