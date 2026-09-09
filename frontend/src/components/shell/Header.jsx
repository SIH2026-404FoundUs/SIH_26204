import { useEffect, useState } from 'react'
import {
  Loader2, LogOut, Menu, X, ChevronDown, Compass, MapPinned,
  ShieldCheck, Store, Route, UserRound, Wrench, Landmark,
  Map as MapIcon, Bell, ClipboardCheck, Tag, BadgeCheck, Users, Bot,
  PanelLeftClose, PanelLeftOpen,
} from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/useAuthStore'
import { useOperatorStore } from '../../store/useOperatorStore'

// One nav model per role drives the desktop bar, the "More" menu, and the
// mobile sheet, so all three can never drift out of sync with each other.
// This is the "expose every implemented feature, nothing hidden behind a
// URL a user has to already know" requirement (§53/§55) made concrete.
// Traveller nav deliberately trimmed (role-based post-login UX revision):
// Explore/Businesses/Alerts are real, working pages -- kept as routes
// (App.jsx), removed only from navigation. Businesses' traveller-facing
// functionality moved under More -> Available Services, scoped to the
// driver/guide/guesthouse business types; Community was renamed (and its
// UX rebuilt) to Suggest a Place; Alerts was replaced by Notifications,
// which filters the same verified-alert data down to what's relevant to
// the traveller's own planned trips instead of showing every alert to
// everyone. Primary bar is exactly Home/Maps/My Trips/More -- Profile
// stays reachable via the existing account menu (ProfileMenu) instead of
// duplicating it here. More leads with Available Services/Suggest a
// Place/Verify a Visit/Safety, then Notifications, then Offers &
// Waitlist (unchanged page -- travellers see offers operators have
// posted and join a waitlist, same as before it was hidden from nav).
const TRAVELLER_PRIMARY = [
  { to: '/home', label: 'Plan a trip', icon: Compass },
  { to: '/map', label: 'One Map', icon: MapIcon },
  { to: '/trips', label: 'My Trips', icon: Route },
]
const TRAVELLER_MORE = [
  { to: '/explore', label: 'Explore pressure', icon: Compass },
  { to: '/multimodal-agent', label: 'Multimodal agent', icon: Bot },
  { to: '/services', label: 'Available Services', icon: Wrench },
  { to: '/community', label: 'Suggest a Place', icon: MapPinned },
  { to: '/visits', label: 'Verify a Visit', icon: BadgeCheck },
  { to: '/safety', label: 'Safety', icon: ShieldCheck },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/offers', label: 'Offers & Waitlist', icon: Tag },
]
// Operator primary bar trimmed to exactly the four post-login features, no
// More section (same pattern as Authority below), no Profile (reachable via
// the account menu like every other role) -- Home, Operator console,
// Businesses, Explore, Map, and Alerts are no longer operator nav items.
// All of it stays reachable as a route (App.jsx) and still works for any
// other role that links to it; only navigation was trimmed, per §56 UI-only
// role gating. "Register Business" itself drops out of this list once the
// operator has registered at least one (navForRole's hasBusinesses flag,
// backed by the same useOperatorStore.myBusinesses RegisterBusiness.jsx
// already populates) -- it did its job, no need for it to keep taking a
// nav slot every time this operator logs back in.
const OPERATOR_PRIMARY_BASE = [
  { to: '/register-business', label: 'Register Business', icon: Store },
  { to: '/hire-people', label: 'Hire People', icon: Users },
  { to: '/operator/waitlist', label: 'Waitlist & Offers', icon: Tag },
  { to: '/visits', label: 'Verify a Visit', icon: BadgeCheck },
  { to: '/multimodal-agent', label: 'Multimodal Agent', icon: Bot },
]
const OPERATOR_MORE = []
// Authority nav trimmed to exactly two destinations, no More section --
// Pressure Map and Businesses are removed as separate nav items (pressure
// data still surfaces inside the Authority Dashboard itself, unchanged).
const AUTHORITY_PRIMARY = [
  { to: '/authority', label: 'Authority Dashboard', icon: Landmark },
  { to: '/community', label: 'Community Review', icon: ClipboardCheck },
  { to: '/multimodal-agent', label: 'Multimodal Agent', icon: Bot },
]
const AUTHORITY_MORE = []

// Shown next to the brand mark once logged in -- the account's own
// server-side role (never a frontend guess), so a traveller/operator/
// authority always sees which one they're signed in as.
const ROLE_LABEL = { traveller: 'Traveller', operator: 'Operator', authority: 'Authority' }

// Backend authorization remains the final authority (§56) -- this only
// decides what a role is shown, never what it's allowed to call.
function navForRole(role, { hasBusinesses = false } = {}) {
  if (role === 'operator') {
    const primary = hasBusinesses
      ? OPERATOR_PRIMARY_BASE.filter((item) => item.to !== '/register-business')
      : OPERATOR_PRIMARY_BASE
    return { primary, more: OPERATOR_MORE }
  }
  if (role === 'authority') return { primary: AUTHORITY_PRIMARY, more: AUTHORITY_MORE }
  return { primary: TRAVELLER_PRIMARY, more: TRAVELLER_MORE }
}

// Logged-out header is just the brand mark + Sign in/Sign up -- Explore and
// Businesses (both real, working public pages) are no longer linked from
// here, matching the same nav-only trim already applied everywhere else.
const PUBLIC_NAV = []

function NavLink({ to, label, icon: Icon, onClick }) {
  const location = useLocation()
  const active = location.pathname === to || location.pathname.startsWith(`${to}/`)
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition hover:bg-white/70 ${active ? 'bg-white text-pressure shadow-sm' : 'text-ink/70'}`}
    >
      {Icon && <Icon size={16} aria-hidden="true" />}
      {label}
    </Link>
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
            Signed in as <span className="text-ink/80">{ROLE_LABEL[authUser.role] || authUser.role}</span>
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

function WorkspaceSidebar({ items, more, collapsed, onToggle }) {
  return (
    <aside className={`fixed bottom-0 left-0 top-[4.5rem] z-40 hidden overflow-y-auto border-r border-ink/5 bg-white/95 px-3 py-5 shadow-[8px_0_30px_rgba(16,25,43,0.04)] backdrop-blur-xl transition-all duration-200 md:block ${collapsed ? 'w-[76px]' : 'w-64'}`}>
      <button type="button" onClick={onToggle} className="mb-5 flex w-full items-center justify-center rounded-xl border border-paper-dim bg-paper px-3 py-2 text-xs font-semibold text-ink/70 transition hover:bg-paper-dim" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
        {collapsed ? <PanelLeftOpen size={17} /> : <><PanelLeftClose size={17} /><span className="ml-2">Collapse menu</span></>}
      </button>
      <div className="space-y-1">
        {!collapsed && <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-ash">Workspace</p>}
        {items.map((item) => <SidebarLink key={item.to} item={item} collapsed={collapsed} />)}
      </div>
      {more.length > 0 && <div className="mt-7 border-t border-paper-dim pt-5">
        {!collapsed && <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-ash">Discover &amp; support</p>}
        {more.map((item) => <SidebarLink key={item.to} item={item} collapsed={collapsed} />)}
      </div>}
    </aside>
  )
}

function SidebarLink({ item, collapsed }) {
  const location = useLocation()
  const active = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
  const Icon = item.icon
  return <Link to={item.to} title={collapsed ? item.label : undefined} className={`group flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition ${collapsed ? 'justify-center' : 'gap-3'} ${active ? 'bg-ink text-paper shadow-sm' : 'text-ink/65 hover:bg-paper hover:text-ink'}`}><Icon size={17} className={active ? 'text-pressure' : 'text-ink/45 group-hover:text-ink'} /><span className={collapsed ? 'sr-only' : ''}>{item.label}</span></Link>
}

export default function Header() {
  const authUser = useAuthStore((state) => state.authUser)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  // Only relevant for deciding whether "Register Business" still belongs in
  // an operator's nav -- fetched here (not just inside RegisterBusiness.jsx)
  // so the header itself knows on every page, not only after visiting that
  // one. Same Zustand store RegisterBusiness.jsx reads/writes, so a
  // successful registration there updates this nav reactively too.
  const myBusinesses = useOperatorStore((state) => state.myBusinesses)
  const fetchMyBusinesses = useOperatorStore((state) => state.fetchMyBusinesses)

  useEffect(() => {
    const closeMobileMenu = () => setMobileOpen(false)
    closeMobileMenu()
  }, [location.pathname])

  useEffect(() => {
    if (authUser?.role === 'operator') fetchMyBusinesses()
  }, [authUser?.role, fetchMyBusinesses])

  const { primary, more } = authUser
    ? navForRole(authUser.role, { hasBusinesses: myBusinesses.length > 0 })
    : { primary: PUBLIC_NAV, more: [] }

  return (
    <>
    <header className="glass-surface sticky top-0 z-50 border-b border-ink/5">
      <div className="mx-auto flex min-h-[4.5rem] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to={authUser ? '/home' : '/'} className="group flex shrink-0 items-center gap-2.5 text-ink">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-paper shadow-sm transition group-hover:bg-ink-soft"><Compass size={19} aria-hidden="true" /></span>
          <span className="font-display text-xl tracking-tight">Sahyatri</span>
          {authUser && (
            <span className="hidden rounded-full bg-paper-dim px-2 py-1 text-[11px] font-sans font-semibold tracking-normal text-ink/60 sm:inline-flex">
              {ROLE_LABEL[authUser.role] || authUser.role}
            </span>
          )}
        </Link>

        <div className="hidden items-center gap-3 md:flex">
          {authUser && <span className="text-sm text-ink/50">{location.pathname === '/map' ? 'Your live travel map' : location.pathname === '/home' ? 'Plan your next escape' : 'Your travel workspace'}</span>}
          <span className="mx-1 h-7 w-px bg-paper-dim" aria-hidden="true" />
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
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-xl border border-paper-dim bg-white p-2.5 text-ink/70 shadow-sm hover:bg-paper-dim md:hidden"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile sheet */}
      {mobileOpen && (
        <nav className="glass-surface border-t border-ink/5 px-4 py-4 md:hidden">
          {authUser && <div className="mb-3 rounded-xl bg-ink px-4 py-3 text-paper"><p className="text-xs text-paper/55">Your travel workspace</p><p className="mt-1 font-display text-lg">Plan with confidence.</p></div>}
          <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-[0.15em] text-relief">Your workspace</p>
          <div className="grid grid-cols-2 gap-1">
            {[...primary, ...more].map((item) => <NavLink key={item.to} {...item} />)}
          </div>
          <div className="mt-3 border-t border-paper-dim pt-3">
            {authUser ? (
              <div className="flex items-center justify-between">
                <button type="button" onClick={() => navigate('/profile')} className="text-sm font-medium text-ink/80">
                  {authUser.fullName} &middot; {ROLE_LABEL[authUser.role] || authUser.role}
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
    {authUser && <WorkspaceSidebar items={primary} more={more} collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((value) => !value)} />}
    </>
  )
}

export function FullPageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper">
      <Loader2 size={28} className="animate-spin text-pressure" aria-label="Loading" />
    </div>
  )
}
