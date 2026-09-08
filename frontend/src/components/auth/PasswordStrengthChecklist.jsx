import { Check, X } from 'lucide-react'
import { checkPasswordRules } from '../../lib/passwordPolicy'

// Shared between signup and reset-password (auth spec §3/§11: "use the same
// strong password policy... show the same password strength indicator").
// Only renders once the field has been touched -- showing a wall of red X's
// before anyone has typed anything reads as an accusation, not help.
export default function PasswordStrengthChecklist({ password, touched }) {
  if (!touched) return null
  const rules = checkPasswordRules(password)
  const passedCount = rules.filter((r) => r.passed).length

  return (
    <div className="mt-2 rounded-lg border border-paper-dim bg-white p-3">
      <div className="mb-1.5 flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-paper-dim">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${(passedCount / rules.length) * 100}%`,
              background: passedCount === rules.length ? 'var(--color-relief)' : 'var(--color-pressure)',
            }}
          />
        </div>
        <span className="text-[10px] text-ash">{passedCount}/{rules.length}</span>
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
        {rules.map((rule) => (
          <li key={rule.key} className={`flex items-center gap-1.5 text-xs ${rule.passed ? 'text-relief' : 'text-ash'}`}>
            {rule.passed ? <Check size={12} aria-hidden="true" /> : <X size={12} aria-hidden="true" />}
            {rule.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
