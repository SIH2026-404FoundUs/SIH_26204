import { useEffect, useState } from 'react'
import {
  Loader2, LogOut, Menu, X, ChevronDown, Compass, Activity, MapPinned, Tag,
  ShieldCheck, TriangleAlert, Phone, Store, Route, UserRound, Wrench, Landmark,
} from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/useAuthStore'

// One nav model per role drives the desktop bar, the "More" menu, and the
// mobile sheet, so all three can never drift out of sync with each other.
// This is the "expose every implemented feature, nothing hidden behind a
// URL a user has to already know" requirement (§53/§55) made concrete.
const TRAVELLER_PRIMARY = [
  { to: '/home', label: 'Home', icon: Compass },
  { to: '/explore', label: 'Explore', icon: Activity },
  { to: '/businesses', label: 'Businesses', icon: Store },
  { to: '/trips', label: 'My Trips', icon: Route },
]
const TRAVELLER_MORE = [
  { to: '/swap', label: 'Alternatives', icon: MapPinned },
  { to: '/community', label: 'Community', icon: MapPinned },
  { to: '/offers', label: 'Offers & waitlist', icon: Tag },
  { to: '/visits', label: 'Verify a visit', icon: ShieldCheck },
  { to: '/alerts', label: 'Alerts', icon: TriangleAlert },
  { to: '/safety', label: 'Safety', icon: Phone },
]
const OPERATOR_PRIMARY = [
  { to: '/home', label: 'Home', icon: Compass },
  { to: '/operator', label: 'Operator console', icon: Wrench },
  { to: '/businesses', label: 'Businesses', icon: Store },
]
const OPERATOR_MORE = [
  { to: '/explore', label: 'Explore', icon: Activity },
  { to: '/visits', label: 'Verify a visit', icon: ShieldCheck },
  { to: '/alerts', label: 'Alerts', icon: TriangleAlert },
]
const AUTHORITY_PRIMARY = [
  { to: '/authority', label: 'Authority dashboard', icon: Landmark },
  { to: '/explore', label: 'Pressure map', icon: Activity },
  { to: '/businesses', label: 'Businesses', icon: Store },
]
const AUTHORITY_MORE = [
  { to: '/community', label: 'Community review', icon: MapPinned },
  { to: '/alerts', label: 'Alerts', icon: TriangleAlert },
  { to: '/safety', label: 'Safety', icon: Phone },
]

// Backend authorization remains the final authority (§56) -- this only
// decides what a role is shown, never what it's allowed to call.
function navForRole(role) {
  if (role === 'operator') return { primary: OPERATOR_PRIMARY, more: OPERATOR_MORE }
  if (role === 'authority') return { primary: AUTHORITY_PRIMARY, more: AUTHORITY_MORE }
  return { primary: TRAVELLER_PRIMARY, more: TRAVELLER_MORE }
}

const PUBLIC_NAV = [
  { to: '/explore', label: 'Explore', icon: Activity },
  { to: '/businesses', label: 'Businesses', icon: Store },
]

function NavLink({ to, label, icon: Icon, onClick }) {
  const location = useLocation()
  const active = location.pathname === to || location.pathname.startsWith(`${to}/`)
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-ink/5 ${active ? 'text-pressure' : 'text-ink/70'}`}
    >
      {Icon && <Icon size={16} aria-hidden="true" />}
      {label}
    </Link>
  )
}

function MoreMenu({ items }) {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const isMoreActive = items.some((item) => item.to === location.pathname)

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [open])

  if (items.length === 0) return null

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-ink/5 ${isMoreActive ? 'text-pressure' : 'text-ink/70'}`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        More
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" className="glass-surface absolute right-0 z-20 mt-1 w-56 rounded-xl p-1.5 shadow-lg">
          {items.map((item) => (
            <NavLink key={item.to} {...item} onClick={() => setOpen(false)} />
          ))}
        </div>
      )}
    </div>
  )
}

function ProfileMenu() {
  const authUser = useAuthStore((state) => state.authUser)
  const logout = useAuthStore((state) => state.logout)
  const [open, setOpen] = useState(false)

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
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-ink/80 transition hover:bg-ink/5"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-paper">
          <UserRound size={15} aria-hidden="true" />
        </span>
        <span className="hidden sm:inline">{authUser.fullName}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" className="glass-surface absolute right-0 z-20 mt-1 w-52 rounded-xl p-1.5 shadow-lg">
          <div className="px-3 py-2 text-xs text-ash">
            Signed in as <span className="text-ink/80">{authUser.role}</span>
          </div>
          <NavLink to="/profile" label="Profile" icon={UserRound} onClick={() => setOpen(false)} />
          <button
            type="button"
            onClick={() => { setOpen(false); logout() }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-pressure transition hover:bg-pressure/10"
          >
            <LogOut size={16} aria-hidden="true" />
            Log out
          </button>
        </div>
      )}
    </div>
  )
}

export default function Header() {
  const authUser = useAuthStore((state) => state.authUser)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const closeMobileMenu = () => setMobileOpen(false)
    closeMobileMenu()
  }, [location.pathname])

  const { primary, more } = authUser ? navForRole(authUser.role) : { primary: PUBLIC_NAV, more: [] }

  return (
    <header className="glass-surface sticky top-0 z-30 border-b-0">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to={authUser ? '/home' : '/'} className="flex items-center gap-2 font-display text-lg tracking-tight text-ink">
          sahyatri
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {primary.map((item) => <NavLink key={item.to} {...item} />)}
          <MoreMenu items={more} />
          <span className="mx-2 h-6 w-px bg-paper-dim" aria-hidden="true" />
          {authUser ? (
            <ProfileMenu />
          ) : (
            <>
              <NavLink to="/signin" label="Sign in" />
              <Link to="/signup">
                <span className="ml-1 inline-flex items-center rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-paper transition hover:bg-ink-soft">Sign up</span>
              </Link>
            </>
          )}
        </nav>

        {/* Mobile toggle */}
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-lg p-2 text-ink/70 hover:bg-ink/5 md:hidden"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile sheet */}
      {mobileOpen && (
        <nav className="glass-surface border-t-0 px-4 py-3 md:hidden">
          <div className="grid grid-cols-2 gap-1">
            {[...primary, ...more].map((item) => <NavLink key={item.to} {...item} />)}
          </div>
          <div className="mt-3 border-t border-paper-dim pt-3">
            {authUser ? (
              <div className="flex items-center justify-between">
                <button type="button" onClick={() => navigate('/profile')} className="text-sm font-medium text-ink/80">
                  {authUser.fullName} &middot; {authUser.role}
                </button>
                <button
                  type="button"
                  onClick={() => useAuthStore.getState().logout()}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-pressure"
                >
                  <LogOut size={16} aria-hidden="true" /> Log out
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Link to="/signin" className="flex-1">
                  <span className="flex w-full items-center justify-center rounded-lg border border-paper-dim px-4 py-2.5 text-sm font-semibold text-ink">Sign in</span>
                </Link>
                <Link to="/signup" className="flex-1">
                  <span className="flex w-full items-center justify-center rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-paper">Sign up</span>
                </Link>
              </div>
            )}
          </div>
        </nav>
      )}
    </header>
  )
}

export function FullPageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper">
      <Loader2 size={28} className="animate-spin text-pressure" aria-label="Loading" />
    </div>
  )
}
