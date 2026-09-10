import { useState } from 'react'
import { Eye, EyeOff, LockKeyhole } from 'lucide-react'
import { inputClass } from '../ui/FormField'

// Show/hide toggle (auth spec §3), shared by every password input in the app.
// A form with more than one password field (signup's password + confirm,
// reset's new + confirm, change-password's current + new + confirm) can
// pass `visible`/`onToggleVisible` to put every field in that form under
// ONE shared toggle -- fixed bug: each field used to manage its own
// visibility independently, so seeing both password fields at once took
// two separate clicks. Omit both props for a single standalone field (e.g.
// sign-in's one password field) and it manages its own state exactly as
// before.
export default function PasswordField({ value, onChange, placeholder = '••••••••', visible: controlledVisible, onToggleVisible, ...props }) {
  const [internalVisible, setInternalVisible] = useState(false)
  const isControlled = controlledVisible !== undefined && onToggleVisible !== undefined
  const visible = isControlled ? controlledVisible : internalVisible
  const toggleVisible = isControlled ? onToggleVisible : () => setInternalVisible((v) => !v)
  return (
    <div className="relative">
      <LockKeyhole size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ash" aria-hidden="true" />
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`${inputClass} pl-10 pr-10`}
        {...props}
      />
      <button
        type="button"
        onClick={toggleVisible}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-ash hover:text-ink/70"
        aria-label={visible ? 'Hide password' : 'Show password'}
        tabIndex={-1}
      >
        {visible ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
      </button>
    </div>
  )
}
