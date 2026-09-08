import { useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Loader2, Mail, XCircle } from 'lucide-react'
import { useAuthStore } from '../../store/useAuthStore'

// /verify-email -- four real states (auth spec §5), driven by whether a
// ?token= is present and what the backend says about it. Never a single
// "loading forever" screen: every path resolves to one of these.
export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const token = searchParams.get('token')
  const emailFromSignup = location.state?.email

  const verifyEmail = useAuthStore((state) => state.verifyEmail)
  const resendVerification = useAuthStore((state) => state.resendVerification)

  const [status, setStatus] = useState(token ? 'checking' : 'pending')
  const [message, setMessage] = useState('')
  const [resend, setResend] = useState({ sending: false, message: null })

  useEffect(() => {
    if (!token) return
    let cancelled = false
    verifyEmail(token).then((result) => {
      if (cancelled) return
      setStatus(result.status === 'already_verified' ? 'already_verified' : result.ok ? 'verified' : 'invalid')
      setMessage(result.message || '')
    })
    return () => { cancelled = true }
  }, [token, verifyEmail])

  async function handleResend() {
    setResend({ sending: true, message: null })
    const result = await resendVerification(emailFromSignup)
    setResend({ sending: false, message: result.message })
  }

  return (
    <div className="isobar-canvas flex min-h-screen items-center justify-center px-4 py-12">
      <div className="glass-surface w-full max-w-md rounded-xl p-8 text-center">
        {status === 'checking' && (
          <>
            <Loader2 size={32} className="mx-auto mb-4 animate-spin text-pressure" aria-hidden="true" />
            <h1 className="font-display text-xl text-ink">Verifying your email…</h1>
          </>
        )}

        {status === 'pending' && (
          <>
            <Mail size={32} className="mx-auto mb-4 text-pressure" aria-hidden="true" />
            <h1 className="font-display text-xl text-ink">Check your email</h1>
            <p className="mt-2 text-sm text-ink/60">
              We sent a verification link to {emailFromSignup ? <strong className="text-ink">{emailFromSignup}</strong> : 'your email address'}.
            </p>
            {emailFromSignup && (
              <button
                type="button"
                onClick={handleResend}
                disabled={resend.sending}
                className="mt-4 text-sm font-semibold text-pressure hover:underline disabled:opacity-60"
              >
                {resend.sending ? 'Sending…' : 'Resend verification email'}
              </button>
            )}
            {resend.message && <p className="mt-2 text-xs text-ink/50">{resend.message}</p>}
          </>
        )}

        {status === 'verified' && (
          <>
            <CheckCircle2 size={32} className="mx-auto mb-4 text-relief" aria-hidden="true" />
            <h1 className="font-display text-xl text-ink">Email verified</h1>
            <Link to="/signin" className="mt-4 inline-flex items-center justify-center rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-paper hover:bg-ink-soft">
              Continue to Sahyatri
            </Link>
          </>
        )}

        {status === 'already_verified' && (
          <>
            <CheckCircle2 size={32} className="mx-auto mb-4 text-relief" aria-hidden="true" />
            <h1 className="font-display text-xl text-ink">Your email is already verified</h1>
            <Link to="/signin" className="mt-4 inline-flex items-center justify-center rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-paper hover:bg-ink-soft">
              Sign in
            </Link>
          </>
        )}

        {status === 'invalid' && (
          <>
            <XCircle size={32} className="mx-auto mb-4 text-pressure" aria-hidden="true" />
            <h1 className="font-display text-xl text-ink">Link invalid or expired</h1>
            <p className="mt-2 text-sm text-ink/60">{message || 'This verification link is invalid or has expired.'}</p>
            <Link to="/signup" className="mt-4 inline-block text-sm font-semibold text-pressure hover:underline">
              Create a new account, or sign in to request a new link
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
