import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Mail } from 'lucide-react'
import { useAuthStore } from '../../store/useAuthStore'
import FormField, { inputClass } from '../ui/FormField'

// /forgot-password -- the confirmation is always the same generic sentence
// regardless of whether the email is registered (auth spec §9: "Do NOT
// reveal whether an email is registered").
export default function ForgotPassword() {
  const forgotPassword = useAuthStore((state) => state.forgotPassword)
  const [email, setEmail] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setIsSending(true)
    await forgotPassword(email)
    setIsSending(false)
    setSent(true)
  }

  return (
    <div className="isobar-canvas flex min-h-screen items-center justify-center px-4 py-12">
      <div className="glass-surface w-full max-w-md rounded-xl p-8">
        <h1 className="font-display text-2xl text-ink">Forgot your password?</h1>
        <p className="mt-2 text-sm text-ink/60">Enter your email and we'll send you reset instructions.</p>

        {sent ? (
          <div className="mt-6 rounded-lg bg-relief/10 p-4 text-sm text-relief">
            If an account exists for this email, we'll send password reset instructions.
          </div>
        ) : (
          <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
            <FormField label="Email address">
              <div className="relative">
                <Mail size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ash" aria-hidden="true" />
                <input required type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className={`${inputClass} pl-10`} />
              </div>
            </FormField>
            <button
              type="submit"
              disabled={isSending}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-ink px-4 py-3 text-sm font-semibold text-paper transition hover:bg-ink-soft disabled:opacity-60"
            >
              {isSending && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
              Send reset link
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-ink/60">
          <Link to="/signin" className="font-semibold text-pressure hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  )
}
