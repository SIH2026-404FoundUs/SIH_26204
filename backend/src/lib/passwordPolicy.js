// Shared strong-password policy (auth spec §2) -- used by signup and by
// reset-password/change-password, so the rule can never drift between the
// three call sites the way min-length alone briefly did in this project's
// history. Frontend has its own copy for progressive validation as the user
// types (frontend/src/lib/passwordPolicy.js), but the backend is the
// authoritative check -- never trust the client's own pass/fail verdict.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

const RULES = [
  { key: "minLength", label: `At least ${PASSWORD_MIN_LENGTH} characters`, test: (p) => p.length >= PASSWORD_MIN_LENGTH },
  { key: "uppercase", label: "One uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { key: "lowercase", label: "One lowercase letter", test: (p) => /[a-z]/.test(p) },
  { key: "number", label: "One number", test: (p) => /[0-9]/.test(p) },
  { key: "special", label: "One special character", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

/** Every rule's pass/fail for a given password, for a strength-checklist UI. */
export function checkPasswordRules(password) {
  const p = typeof password === "string" ? password : "";
  return RULES.map((rule) => ({ key: rule.key, label: rule.label, passed: rule.test(p) }));
}

/**
 * Full validation used at the API boundary. Returns null when valid, or a
 * single human-readable message naming the first thing wrong -- callers that
 * want the full checklist (the frontend, for progressive UI) use
 * checkPasswordRules() directly instead.
 */
export function validatePasswordPolicy(password) {
  if (typeof password !== "string") return "Password must be a string";
  if (password.length > PASSWORD_MAX_LENGTH) return `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer`;
  const failed = checkPasswordRules(password).find((r) => !r.passed);
  if (failed) return `Password must include: ${failed.label.toLowerCase()}`;
  return null;
}
