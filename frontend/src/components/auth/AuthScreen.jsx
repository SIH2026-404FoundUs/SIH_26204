import { useEffect, useState } from 'react'
import { Loader2, LockKeyhole, Mail, UserRound } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/useAuthStore'
import Alert from '../ui/Alert'
import FormField, { inputClass } from '../ui/FormField'

/**
 * Landing + Sign in are one screen (UI/UX doc Page 1): a static dark isobar
 * canvas establishes the visual language before the user has any trip data,
 * with a single centred paper card holding the form -- the one screen in the
 * product where centred alignment is correct, since there is no data
 * hierarchy to express yet (§3.3). Sign up (Page 2) reuses the identical
 * shell with one more field.
 */
export default function AuthScreen({ mode }) {
  const isLogin = mode === 'login'
  const navigate = useNavigate()

  const signup = useAuthStore((state) => state.signup)
  const login = useAuthStore((state) => state.login)
  const clearError = useAuthStore((state) => state.clearError)
  const error = useAuthStore((state) => state.error)
  const isPending = useAuthStore((state) => (isLogin ? state.isLoggingIn : state.isSigningUp))

  const [form, setForm] = useState({ fullName: '', email: '', password: '' })
  const [localError, setLocalError] = useState(null)

  useEffect(() => clearError, [mode, clearError])

  const update = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))

  async function handleSubmit(event) {
    event.preventDefault()
    setLocalError(null)
    // Matches the backend's own 6-character rule (auth.controller.js) so the
    // error is caught before a round trip, not after a 400 comes back.
    if (!isLogin && form.password.length < 6) {
      setLocalError('Password must be at least 6 characters')
      return
    }
    const ok = isLogin ? await login({ email: form.email, password: form.password }) : await signup(form)
    // On success, go straight to the trip planner -- no separate "welcome"
    // interstitial (Page 2: "the product's first real moment should be the
    // pressure question, not a marketing welcome screen").
    if (ok) navigate('/home')
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
            <FormField label="Email address">
              <div className="relative">
                <Mail size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ash" aria-hidden="true" />
                <input required type="email" placeholder="you@example.com" value={form.email} onChange={update('email')} className={`${inputClass} pl-10`} />
              </div>
            </FormField>
            <FormField label="Password">
              <div className="relative">
                <LockKeyhole size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ash" aria-hidden="true" />
                <input required type="password" placeholder="••••••••" value={form.password} onChange={update('password')} className={`${inputClass} pl-10`} />
              </div>
            </FormField>
            {(localError || error) && <Alert tone="error">{localError || error}</Alert>}
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
