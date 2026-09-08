// Mirrors backend/src/lib/passwordPolicy.js exactly -- this copy is for
// progressive UI feedback only (auth spec §3: "validate progressively,
// don't reveal requirements only after submission"). The backend is the
// authoritative check; this never replaces it, it just gives the user
// live feedback while typing instead of a round trip to find out.
export const PASSWORD_MIN_LENGTH = 8

const RULES = [
  { key: 'minLength', label: `At least ${PASSWORD_MIN_LENGTH} characters`, test: (p) => p.length >= PASSWORD_MIN_LENGTH },
  { key: 'uppercase', label: 'Uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { key: 'lowercase', label: 'Lowercase letter', test: (p) => /[a-z]/.test(p) },
  { key: 'number', label: 'Number', test: (p) => /[0-9]/.test(p) },
  { key: 'special', label: 'Special character', test: (p) => /[^A-Za-z0-9]/.test(p) },
]

export function checkPasswordRules(password) {
  const p = typeof password === 'string' ? password : ''
  return RULES.map((rule) => ({ key: rule.key, label: rule.label, passed: rule.test(p) }))
}

export function isPasswordValid(password) {
  return checkPasswordRules(password).every((r) => r.passed)
}
