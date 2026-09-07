import { useEffect, useState } from 'react'
import { Loader2, LockKeyhole, LogOut, Mail, MapPin, UserRound } from 'lucide-react'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from './store/useAuthStore'
import PressureHeatmap from './components/pressure/PressureHeatmap'
import { SwapPage, TripConfirmation } from './components/swap'
import TripPlanner from './components/planner/TripPlanner'
import VisitVerify from './components/trust/VisitVerify'
import CommunitySubmit from './components/trust/CommunitySubmit'
import OffersWaitlist from './components/trust/OffersWaitlist'
import Alerts from './components/trust/Alerts'
import Safety from './components/trust/Safety'
import Businesses from './components/trust/Businesses'

function Header() {
  const location = useLocation()
  const authUser = useAuthStore((state) => state.authUser)
  const logout = useAuthStore((state) => state.logout)

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <MapPin size={20} aria-hidden="true" />
          </span>
          Tourist
        </Link>
        <nav className="flex items-center gap-2 text-sm font-medium">
          <Link to="/pressure" className={`rounded-lg px-4 py-2 transition hover:bg-slate-100 ${location.pathname === '/pressure' ? 'text-indigo-600' : 'text-slate-600'}`}>
            Pressure
          </Link>
          <Link to="/swap" className={`rounded-lg px-4 py-2 transition hover:bg-slate-100 ${location.pathname === '/swap' ? 'text-indigo-600' : 'text-slate-600'}`}>
            Swap Engine
          </Link>
          <Link to="/planner" className={`rounded-lg px-4 py-2 transition hover:bg-slate-100 ${location.pathname === '/planner' ? 'text-indigo-600' : 'text-slate-600'}`}>
            Plan a trip
          </Link>
          <Link to="/visits" className={`rounded-lg px-4 py-2 transition hover:bg-slate-100 ${location.pathname === '/visits' ? 'text-indigo-600' : 'text-slate-600'}`}>
            Visits
          </Link>
          <Link to="/community" className={`rounded-lg px-4 py-2 transition hover:bg-slate-100 ${location.pathname === '/community' ? 'text-indigo-600' : 'text-slate-600'}`}>
            Community
          </Link>
          <Link to="/offers" className={`rounded-lg px-4 py-2 transition hover:bg-slate-100 ${location.pathname === '/offers' ? 'text-indigo-600' : 'text-slate-600'}`}>
            Offers
          </Link>
          <Link to="/alerts" className={`rounded-lg px-4 py-2 transition hover:bg-slate-100 ${location.pathname === '/alerts' ? 'text-indigo-600' : 'text-slate-600'}`}>
            Alerts
          </Link>
          <Link to="/safety" className={`rounded-lg px-4 py-2 transition hover:bg-slate-100 ${location.pathname === '/safety' ? 'text-indigo-600' : 'text-slate-600'}`}>
            Safety
          </Link>
          <Link to="/businesses" className={`rounded-lg px-4 py-2 transition hover:bg-slate-100 ${location.pathname === '/businesses' ? 'text-indigo-600' : 'text-slate-600'}`}>
            Businesses
          </Link>
          {authUser ? (

            <>
              <span className="px-2 text-slate-600">{authUser.fullName}</span>
              <button type="button" onClick={logout} className="flex items-center gap-2 rounded-lg px-4 py-2 text-slate-600 transition hover:bg-slate-100">
                <LogOut size={16} aria-hidden="true" />
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className={`rounded-lg px-4 py-2 transition hover:bg-slate-100 ${location.pathname === '/login' ? 'text-indigo-600' : 'text-slate-600'}`}>
                Log in
              </Link>
              <Link to="/signup" className="rounded-lg bg-indigo-600 px-4 py-2 text-white transition hover:bg-indigo-700">
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}

function Field({ icon: Icon, label, type = 'text', placeholder, value, onChange }) {
  return (
    <label className="block text-left">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <span className="relative block">
        <Icon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input type={type} placeholder={placeholder} required value={value} onChange={onChange} className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" />
      </span>
    </label>
  )
}

function AuthCard({ mode }) {
  const isLogin = mode === 'login'
  const navigate = useNavigate()

  const signup = useAuthStore((state) => state.signup)
  const login = useAuthStore((state) => state.login)
  const clearError = useAuthStore((state) => state.clearError)
  const error = useAuthStore((state) => state.error)
  const isPending = useAuthStore((state) => (isLogin ? state.isLoggingIn : state.isSigningUp))

  const [form, setForm] = useState({ fullName: '', email: '', password: '' })

  // Drop a stale message when switching between the login and signup routes.
  useEffect(() => clearError, [mode, clearError])

  function update(field) {
    return (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const ok = isLogin
      ? await login({ email: form.email, password: form.password })
      : await signup(form)
    if (ok) navigate('/')
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-slate-50 px-6 py-12">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{isLogin ? 'Welcome back' : 'Create your account'}</h1>
          <p className="mt-2 text-sm text-slate-500">{isLogin ? 'Log in to continue planning your next trip.' : 'Start discovering places made for you.'}</p>
        </div>
        <form className="space-y-5" onSubmit={handleSubmit}>
          {!isLogin && <Field icon={UserRound} label="Full name" placeholder="Your name" value={form.fullName} onChange={update('fullName')} />}
          <Field icon={Mail} label="Email address" type="email" placeholder="you@example.com" value={form.email} onChange={update('email')} />
          <Field icon={LockKeyhole} label="Password" type="password" placeholder="••••••••" value={form.password} onChange={update('password')} />
          {error && (
            <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
          )}
          <button type="submit" disabled={isPending} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60">
            {isPending && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {isLogin ? 'Log in' : 'Create account'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">
          {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
          <Link to={isLogin ? '/signup' : '/login'} className="font-semibold text-indigo-600 hover:text-indigo-700">{isLogin ? 'Sign up' : 'Log in'}</Link>
        </p>
      </section>
    </main>
  )
}

function Home() {
  const authUser = useAuthStore((state) => state.authUser)

  return (
    <main className="flex-1 bg-slate-50 px-6 py-12">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {authUser ? `Welcome back, ${authUser.fullName}` : 'Welcome'}
        </h1>
      </div>
    </main>
  )
}

function App() {
  const authUser = useAuthStore((state) => state.authUser)
  const isCheckingAuth = useAuthStore((state) => state.isCheckingAuth)
  const checkAuth = useAuthStore((state) => state.checkAuth)

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  if (isCheckingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <Loader2 size={28} className="animate-spin text-indigo-600" aria-label="Loading" />
      </div>
    )
  }

  return (
    <BrowserRouter>
      <div className="flex min-h-screen flex-col bg-white">
        <Header />
        <Routes>
          <Route path="/" element={authUser ? <Home /> : <Navigate to="/login" replace />} />
          {/* Open — no auth, it only reads the public pressure endpoints */}
          <Route
            path="/pressure"
            element={
              <main className="flex-1 bg-slate-50 px-6 py-12">
                <div className="mx-auto max-w-6xl">
                  <h1 className="mb-6 text-2xl font-semibold tracking-tight text-slate-900">Destination Pressure</h1>
                  <PressureHeatmap />
                </div>
              </main>
            }
          />
          <Route path="/swap" element={<SwapPage />} />
          <Route path="/trip-confirmation" element={<TripConfirmation />} />
          <Route
            path="/planner"
            element={
              <main className="flex-1 bg-slate-50 px-6 py-12">
                <TripPlanner />
              </main>
            }
          />
          <Route
            path="/visits"
            element={authUser ? <main className="flex-1 bg-slate-50 px-6 py-12"><VisitVerify /></main> : <Navigate to="/login" replace />}
          />
          <Route
            path="/community"
            element={authUser ? <main className="flex-1 bg-slate-50 px-6 py-12"><CommunitySubmit /></main> : <Navigate to="/login" replace />}
          />
          <Route
            path="/offers"
            element={authUser ? <main className="flex-1 bg-slate-50 px-6 py-12"><OffersWaitlist /></main> : <Navigate to="/login" replace />}
          />
          {/* Open — reads the public alerts endpoint, no auth required */}
          <Route
            path="/alerts"
            element={<main className="flex-1 bg-slate-50 px-6 py-12"><Alerts /></main>}
          />
          <Route
            path="/safety"
            element={authUser ? <main className="flex-1 bg-slate-50 px-6 py-12"><Safety /></main> : <Navigate to="/login" replace />}
          />
          {/* Open — reads the public business search endpoint, no auth required */}
          <Route
            path="/businesses"
            element={<main className="flex-1 bg-slate-50 px-6 py-12"><Businesses /></main>}
          />
          <Route path="/login" element={authUser ? <Navigate to="/" replace /> : <AuthCard mode="login" />} />
          <Route path="/signup" element={authUser ? <Navigate to="/" replace /> : <AuthCard mode="signup" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
