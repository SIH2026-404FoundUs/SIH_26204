import { useEffect, useState } from 'react'
import {
  Loader2, LockKeyhole, LogOut, Mail, MapPin, UserRound, Menu, X,
  ChevronDown, Activity, Compass, ShieldCheck, Users, MapPinned, Tag,
  TriangleAlert, Phone, Store,
} from 'lucide-react'
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
import Button from './components/ui/Button'
import Card from './components/ui/Card'
import Alert from './components/ui/Alert'
import FormField, { inputClass } from './components/ui/FormField'

// One nav model drives the desktop bar, the "More" menu, and the mobile
// sheet, so all three can never drift out of sync with each other.
const PRIMARY_NAV = [
  { to: '/planner', label: 'Plan a trip', icon: Compass },
  { to: '/pressure', label: 'Crowding', icon: Activity },
  { to: '/swap', label: 'Alternatives', icon: MapPin },
]
const MORE_NAV = [
  { to: '/community', label: 'Community', icon: MapPinned },
  { to: '/offers', label: 'Offers', icon: Tag },
  { to: '/visits', label: 'Visits', icon: ShieldCheck },
  { to: '/alerts', label: 'Alerts', icon: TriangleAlert },
  { to: '/safety', label: 'Safety', icon: Phone },
  { to: '/businesses', label: 'Businesses', icon: Store },
]

function NavLink({ to, label, icon: Icon, onClick }) {
  const location = useLocation()
  const active = location.pathname === to
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-slate-100 ${active ? 'text-indigo-600' : 'text-slate-600'}`}
    >
      {Icon && <Icon size={16} aria-hidden="true" />}
      {label}
    </Link>
  )
}

function MoreMenu() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const isMoreActive = MORE_NAV.some((item) => item.to === location.pathname)

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [open])

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-slate-100 ${isMoreActive ? 'text-indigo-600' : 'text-slate-600'}`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        More
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-10 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
          {MORE_NAV.map((item) => (
            <NavLink key={item.to} {...item} onClick={() => setOpen(false)} />
          ))}
        </div>
      )}
    </div>
  )
}

function Header() {
  const authUser = useAuthStore((state) => state.authUser)
  const logout = useAuthStore((state) => state.logout)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  useEffect(() => setMobileOpen(false), [location.pathname])

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <MapPin size={20} aria-hidden="true" />
          </span>
          Tourist
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {PRIMARY_NAV.map((item) => <NavLink key={item.to} {...item} />)}
          <MoreMenu />
          <span className="mx-2 h-6 w-px bg-slate-200" aria-hidden="true" />
          {authUser ? (
            <>
              <span className="px-2 text-sm text-slate-600">{authUser.fullName}</span>
              <Button variant="ghost" size="sm" icon={LogOut} onClick={logout}>Log out</Button>
            </>
          ) : (
            <>
              <NavLink to="/login" label="Log in" />
              <Link to="/signup"><Button variant="primary" size="sm">Sign up</Button></Link>
            </>
          )}
        </nav>

        {/* Mobile toggle */}
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile sheet */}
      {mobileOpen && (
        <nav className="border-t border-slate-200 bg-white px-4 py-3 md:hidden">
          <div className="grid grid-cols-2 gap-1">
            {[...PRIMARY_NAV, ...MORE_NAV].map((item) => <NavLink key={item.to} {...item} />)}
          </div>
          <div className="mt-3 border-t border-slate-100 pt-3">
            {authUser ? (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">{authUser.fullName}</span>
                <Button variant="ghost" size="sm" icon={LogOut} onClick={logout}>Log out</Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Link to="/login" className="flex-1"><Button variant="secondary" fullWidth>Log in</Button></Link>
                <Link to="/signup" className="flex-1"><Button variant="primary" fullWidth>Sign up</Button></Link>
              </div>
            )}
          </div>
        </nav>
      )}
    </header>
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

  useEffect(() => clearError, [mode, clearError])

  const update = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))

  async function handleSubmit(event) {
    event.preventDefault()
    const ok = isLogin ? await login({ email: form.email, password: form.password }) : await signup(form)
    if (ok) navigate('/')
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-slate-50 px-6 py-12">
      <Card className="w-full max-w-md" padding="p-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{isLogin ? 'Welcome back' : 'Create your account'}</h1>
          <p className="mt-2 text-sm text-slate-500">{isLogin ? 'Log in to continue planning your next trip.' : 'Start discovering places made for you.'}</p>
        </div>
        <form className="space-y-5" onSubmit={handleSubmit}>
          {!isLogin && (
            <FormField label="Full name">
              <div className="relative">
                <UserRound size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input required placeholder="Your name" value={form.fullName} onChange={update('fullName')} className={`${inputClass} pl-10`} />
              </div>
            </FormField>
          )}
          <FormField label="Email address">
            <div className="relative">
              <Mail size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input required type="email" placeholder="you@example.com" value={form.email} onChange={update('email')} className={`${inputClass} pl-10`} />
            </div>
          </FormField>
          <FormField label="Password">
            <div className="relative">
              <LockKeyhole size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input required type="password" placeholder="••••••••" value={form.password} onChange={update('password')} className={`${inputClass} pl-10`} />
            </div>
          </FormField>
          {error && <Alert tone="error">{error}</Alert>}
          <Button type="submit" variant="primary" fullWidth loading={isPending}>{isLogin ? 'Log in' : 'Create account'}</Button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">
          {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
          <Link to={isLogin ? '/signup' : '/login'} className="font-semibold text-indigo-600 hover:text-indigo-700">{isLogin ? 'Sign up' : 'Log in'}</Link>
        </p>
      </Card>
    </main>
  )
}

function QuickLink({ to, icon: Icon, label, description }) {
  return (
    <Link to={to}>
      <Card className="h-full transition hover:border-indigo-300 hover:shadow-sm" padding="p-4">
        <Icon size={20} className="text-indigo-600" aria-hidden="true" />
        <p className="mt-2 text-sm font-semibold text-slate-900">{label}</p>
        <p className="mt-0.5 text-xs text-slate-500">{description}</p>
      </Card>
    </Link>
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
        <p className="mt-1 text-sm text-slate-500">Where do you want to start?</p>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <QuickLink to="/planner" icon={Compass} label="Plan a trip" description="Get a full itinerary, crowding-checked" />
          <QuickLink to="/pressure" icon={Activity} label="Crowding" description="See how busy places are right now" />
          <QuickLink to="/swap" icon={MapPin} label="Alternatives" description="Find a quieter place or date" />
          <QuickLink to="/community" icon={Users} label="Community" description="Suggest a place you've discovered" />
          <QuickLink to="/offers" icon={Tag} label="Offers" description="Claim a flash discount nearby" />
          <QuickLink to="/safety" icon={Phone} label="Safety" description="Emergency contacts and reporting" />
        </div>
      </div>
    </main>
  )
}

// Consistent page container so every route doesn't redeclare the same
// background/padding classes.
function Page({ children }) {
  return <main className="flex-1 bg-slate-50 px-6 py-12">{children}</main>
}

function RequireAuth({ children }) {
  const authUser = useAuthStore((state) => state.authUser)
  return authUser ? <Page>{children}</Page> : <Navigate to="/login" replace />
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
          {/* Open — reads only public endpoints */}
          <Route path="/pressure" element={<Page><div className="mx-auto max-w-6xl"><PressureHeatmap /></div></Page>} />
          <Route path="/swap" element={<SwapPage />} />
          <Route path="/trip-confirmation" element={<TripConfirmation />} />
          <Route path="/planner" element={<Page><TripPlanner /></Page>} />
          <Route path="/visits" element={<RequireAuth><VisitVerify /></RequireAuth>} />
          <Route path="/community" element={<RequireAuth><CommunitySubmit /></RequireAuth>} />
          <Route path="/offers" element={<RequireAuth><OffersWaitlist /></RequireAuth>} />
          {/* Open — reads the public alerts endpoint */}
          <Route path="/alerts" element={<Page><Alerts /></Page>} />
          <Route path="/safety" element={<RequireAuth><Safety /></RequireAuth>} />
          {/* Open — reads the public business search endpoint */}
          <Route path="/businesses" element={<Page><Businesses /></Page>} />
          <Route path="/login" element={authUser ? <Navigate to="/" replace /> : <AuthCard mode="login" />} />
          <Route path="/signup" element={authUser ? <Navigate to="/" replace /> : <AuthCard mode="signup" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
