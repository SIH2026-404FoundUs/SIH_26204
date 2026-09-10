import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuthStore } from '../../store/useAuthStore'
import { isPasswordValid } from '../../lib/passwordPolicy'
import Alert from '../ui/Alert'
import FormField from '../ui/FormField'
import PasswordField from './PasswordField'
import PasswordStrengthChecklist from './PasswordStrengthChecklist'

// /reset-password?token=... -- same strong password policy and strength
// indicator as signup (auth spec §11). On success, routes to /signin rather
// than auto-logging in (matches the backend deliberately not issuing a
// session on reset either).
export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()
  const resetPassword = useAuthStore((state) => state.resetPassword)

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [touched, setTouched] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)
  // One toggle for both fields (bug fix: each used to manage its own
  // show/hide independently, so seeing both took two clicks).
  const [passwordVisible, setPasswordVisible] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)

    if (!token) {
      setError('This reset link is missing its token. Request a new one.')
      return
    }
    if (!isPasswordValid(password)) {
      setError('Password does not meet the requirements below')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setIsSubmitting(true)
    const result = await resetPassword({ token, password, confirmPassword })
    setIsSubmitting(false)

    if (result.ok) {
      navigate('/signin', { state: { justReset: true } })
    } else {
      setError(result.message)
    }
  }

  return (
    <div className="isobar-canvas flex min-h-screen items-center justify-center px-4 py-12">
      <div className="glass-surface w-full max-w-md rounded-xl p-8">
        <h1 className="font-display text-2xl text-ink">Create a new password</h1>
        <p className="mt-2 text-sm text-ink/60">Choose a strong password you haven't used before.</p>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <FormField label="New password">
            <PasswordField
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setTouched(true)}
              placeholder="Enter new password"
              visible={passwordVisible}
              onToggleVisible={() => setPasswordVisible((v) => !v)}
              required
            />
          </FormField>
          <PasswordStrengthChecklist password={password} touched={touched} />

          <FormField label="Confirm new password" error={confirmPassword && password !== confirmPassword ? 'Passwords do not match' : undefined}>
            <PasswordField
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              visible={passwordVisible}
              onToggleVisible={() => setPasswordVisible((v) => !v)}
              required
            />
          </FormField>

          {error && <Alert tone="error">{error}</Alert>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-ink px-4 py-3 text-sm font-semibold text-paper transition hover:bg-ink-soft disabled:opacity-60"
          >
            {isSubmitting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            Reset password
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-ink/60">
          <Link to="/signin" className="font-semibold text-pressure hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  )
}
