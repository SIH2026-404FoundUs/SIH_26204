import { useState } from 'react'
import { Eye, EyeOff, LockKeyhole } from 'lucide-react'
import { inputClass } from '../ui/FormField'

// Show/hide toggle (auth spec §3), shared by every password input in the app.
export default function PasswordField({ value, onChange, placeholder = '••••••••', ...props }) {
  const [visible, setVisible] = useState(false)
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
        onClick={() => setVisible((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-ash hover:text-ink/70"
        aria-label={visible ? 'Hide password' : 'Show password'}
        tabIndex={-1}
      >
        {visible ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
      </button>
    </div>
  )
}
