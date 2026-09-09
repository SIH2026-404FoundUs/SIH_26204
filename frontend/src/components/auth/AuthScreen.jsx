import { useEffect, useState } from 'react'
import { Loader2, Mail, UserRound } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/useAuthStore'
import { isPasswordValid } from '../../lib/passwordPolicy'
import Alert from '../ui/Alert'
import FormField, { inputClass } from '../ui/FormField'
import PasswordField from './PasswordField'
import PasswordStrengthChecklist from './PasswordStrengthChecklist'

// Where each role lands right after authenticating (auth spec §7/§20).
const ROLE_HOME = { traveller: '/home', operator: '/operator', authority: '/authority' }

// Signup lets someone pick their account type up front. This is a UX
// convenience only: the backend independently whitelists this value against
// the same three-item enum before it ever reaches the database, so nothing
// typed or replayed here can grant a role beyond what the server allows.
// Every route that actually matters for an operator/authority account still
// checks req.user.role on the server -- this selector controls nothing by
// itself.
const ROLE_OPTIONS = [
  { value: 'traveller', label: 'Traveller' },
  { value: 'operator', label: 'Operator' },
  { value: 'authority', label: 'Authority' },
]

/**
 * Landing + Sign in are one screen (UI/UX doc Page 1): a static dark isobar
 * canvas establishes the visual language before the user has any trip data,
 * with a single centred paper card holding the form -- the one screen in the
 * product where centred alignment is correct, since there is no data
 * hierarchy to express yet (§3.3). Sign up (Page 2) reuses the identical
 * shell with a few more fields.
 */
export default function AuthScreen({ mode }) {
  const isLogin = mode === 'login'
  const navigate = useNavigate()

  const signup = useAuthStore((state) => state.signup)
  const login = useAuthStore((state) => state.login)
  const resendVerification = useAuthStore((state) => state.resendVerification)
  const clearError = useAuthStore((state) => state.clearError)
  const error = useAuthStore((state) => state.error)
  const unverifiedEmail = useAuthStore((state) => state.unverifiedEmail)
  const isPending = useAuthStore((state) => (isLogin ? state.isLoggingIn : state.isSigningUp))

  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirmPassword: '', role: 'traveller' })
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [localError, setLocalError] = useState(null)
  const [resendState, setResendState] = useState({ sending: false, message: null })

  useEffect(() => clearError, [mode, clearError])

  const update = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))

  async function handleSubmit(event) {
    event.preventDefault()
    setLocalError(null)

    if (!isLogin) {
      // Caught before a round trip -- the backend enforces the same policy
      // independently either way (auth spec §2: "Do NOT rely only on
      // frontend validation").
      if (!isPasswordValid(form.password)) {
        setLocalError('Password does not meet the requirements below')
        return
      }
      if (form.password !== form.confirmPassword) {
        setLocalError('Passwords do not match')
        return
      }
      const result = await signup(form)
      if (result) navigate('/verify-email', { state: { email: result.email, pending: true } })
      return
    }

    const ok = await login({ email: form.email, password: form.password })
    if (ok) {
      const role = useAuthStore.getState().authUser?.role
      navigate(ROLE_HOME[role] || '/home')
    }
  }

  async function handleResend() {
    setResendState({ sending: true, message: null })
    const result = await resendVerification(unverifiedEmail)
    setResendState({ sending: false, message: result.message })
  }

  return (
    <div className="isobar-canvas flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {isLogin && (
          <div className="mb-8 text-center">
            <p className="font-display text-3xl text-paper">sahyatri</p>
            <p className="mt-2 text-sm text-paper/60">Tourism, redistributed.</p>
            <p className="text-sm text-paper/60">We check crowding before you book, not after.</p>
          </div>
        )}

        <div className="glass-surface rounded-xl p-8">
          <div className="mb-6 text-center">
            <h1 className="font-display text-2xl text-ink">{isLogin ? 'Sign in' : 'Create your account'}</h1>
            <p className="mt-2 text-sm text-ink/60">
              {isLogin ? 'Continue planning your next trip.' : 'Start with the trip question, not a welcome tour.'}
            </p>
          </div>
          <form className="space-y-5" onSubmit={handleSubmit}>
            {!isLogin && (
              <FormField label="Full name">
                <div className="relative">
                  <UserRound size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ash" aria-hidden="true" />
                  <input required placeholder="Your name" value={form.fullName} onChange={update('fullName')} className={`${inputClass} pl-10`} />
                </div>
              </FormField>
            )}

            {!isLogin && (
              <FormField label="I am a...">
                <div className="grid grid-cols-3 gap-2">
                  {ROLE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, role: opt.value }))}
                      className={`rounded-lg border px-2 py-2 text-xs font-medium transition ${
                        form.role === opt.value
                          ? 'border-ink bg-ink text-paper'
                          : 'border-paper-dim bg-paper text-ink/70 hover:border-ink/40'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </FormField>
            )}
            <FormField label="Email address">
              <div className="relative">
                <Mail size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ash" aria-hidden="true" />
                <input required type="email" placeholder="you@example.com" value={form.email} onChange={update('email')} className={`${inputClass} pl-10`} />
              </div>
            </FormField>
            <FormField label="Password">
              <PasswordField
                value={form.password}
                onChange={update('password')}
                onFocus={() => setPasswordTouched(true)}
                required
              />
            </FormField>
            {!isLogin && <PasswordStrengthChecklist password={form.password} touched={passwordTouched} />}

            {!isLogin && (
              <FormField label="Confirm password" error={form.confirmPassword && form.password !== form.confirmPassword ? 'Passwords do not match' : undefined}>
                <PasswordField value={form.confirmPassword} onChange={update('confirmPassword')} required />
              </FormField>
            )}

            {isLogin && (
              <div className="text-right">
                <Link to="/forgot-password" className="text-xs font-medium text-pressure hover:underline">Forgot password?</Link>
              </div>
            )}

            {(localError || error) && (
              <Alert tone="error">
                <div>{localError || error}</div>
                {unverifiedEmail && (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendState.sending}
                    className="mt-1 text-xs font-semibold underline disabled:opacity-60"
                  >
                    {resendState.sending ? 'Sending…' : 'Resend verification email'}
                  </button>
                )}
                {resendState.message && <div className="mt-1 text-xs">{resendState.message}</div>}
              </Alert>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-ink px-4 py-3 text-sm font-semibold text-paper transition hover:bg-ink-soft disabled:opacity-60"
            >
              {isPending && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
              {isLogin ? 'Sign in' : 'Create account'}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-ink/60">
            {isLogin ? "New here?" : 'Already have an account?'}{' '}
            <Link to={isLogin ? '/signup' : '/signin'} className="font-semibold text-pressure hover:underline">
              {isLogin ? 'Create an account' : 'Sign in'}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
