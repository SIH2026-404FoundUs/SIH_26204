import { useEffect, useState } from 'react'
import {
  Loader2, LogOut, Menu, X, ChevronDown, Compass, MapPinned,
  ShieldCheck, Store, Route, UserRound, Wrench, Landmark,
  Map as MapIcon, Bell, ClipboardCheck, Tag, BadgeCheck, Users, Bot,
  PanelLeftClose, PanelLeftOpen, CheckCircle2, Megaphone, IndianRupee, Briefcase, ClipboardList, ListChecks, ImageOff,
} from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/useAuthStore'
import { useOperatorStore } from '../../store/useOperatorStore'
import { useNotificationsStore } from '../../store/useNotificationsStore'
import { useDataSaverStore } from '../../store/useDataSaverStore'
import { getDestinationLabel } from '../../lib/destinations'
import { alertSeverity, alertKindLabel } from '../../lib/labels'
import { timeAgo } from '../../lib/time'

// One nav model per role drives the desktop bar, the "More" menu, and the
// mobile sheet, so all three can never drift out of sync with each other.
// This is the "expose every implemented feature, nothing hidden behind a
// URL a user has to already know" requirement (§53/§55) made concrete.
// Traveller nav deliberately trimmed (role-based post-login UX revision):
// Explore/Businesses/Alerts are real, working pages -- kept as routes
// (App.jsx), removed only from navigation. Businesses' traveller-facing
// functionality moved under More -> Available Services, scoped to the
// driver/guide/guesthouse business types; Community was renamed (and its
// UX rebuilt) to Suggest a Place; Alerts was replaced by Notifications.
// Primary bar is Home/Maps/Community Forum -- Profile stays reachable via
// the existing account menu (ProfileMenu) instead of duplicating it here.
// Community Forum was promoted out of More into the primary bar itself (a
// traveller shouldn't need an extra click for it). More is ordered by when a
// traveller actually needs each one, not alphabetically: Available Services
// and Offers & Waitlist are both discovery/what-to-book actions so they lead;
// the Multimodal agent is an anytime helper that fits right after; Suggest a
// Place is a contribution action (usually after exploring/visiting somewhere);
// Verify a Visit and Safety are in-trip support, so they close out the list.
// Notifications moved out of here entirely into a bell button in the header
// itself (badge shows the live count, NotificationBell below); My Trips moved
// out of the primary bar into the ProfileMenu dropdown, directly under the
// Profile link -- both were relocated, not removed, so they're still one
// click away, just under the account cluster they logically belong to
// instead of taking a full nav slot.
const TRAVELLER_PRIMARY = [
  { to: '/home', label: 'Plan a trip', icon: Compass },
  { to: '/map', label: 'One Map', icon: MapIcon },
  { to: '/forum', label: 'Community Forum', icon: Users },
]
const TRAVELLER_MORE = [
  { to: '/services', label: 'Available Services', icon: Wrench },
  { to: '/offers', label: 'Offers & Waitlist', icon: Tag },
  { to: '/multimodal-agent', label: 'Multimodal agent', icon: Bot },
  { to: '/community', label: 'Suggest a Place', icon: MapPinned },
  { to: '/visits', label: 'Verify a Visit', icon: BadgeCheck },
  { to: '/safety', label: 'Safety', icon: ShieldCheck },
]
// Operator nav split into primary/more the same way Traveller's already is
// (previously operator dumped all nine destinations into one flat primary
// bar with no More section at all -- inconsistent with every other
// multi-item role, and it read as a grab-bag rather than a workflow).
// PRIMARY is "the job": the core loop of running a listing day to day --
// set up (Console, Register Business), get staffed (Hire People, which now
// also holds Post a Gig as its third tab), then the two genuinely daily
// operational tasks (Verify a Visit, Waitlist & Offers). MORE is "insight,
// growth, and support" -- things reached for periodically, not per booking:
// Revenue Management (GET/POST /v1/revenue/:businessId/..., demand
// forecast + price/promotion/inventory recommendations), Content Generator
// (Tourism Publicity Generator, Groq/Mistral marketing copy), Raise a
// Complaint (POST /v1/safety/complaints -- never role-restricted
// server-side, just previously nothing in this nav pointed at it), and
// Multimodal Agent, same "anytime helper closes out More" placement
// Traveller already uses. "Register Business" still drops out of PRIMARY
// once at least one business is registered (navForRole's hasBusinesses
// flag) -- reachable afterward from the profile-menu dropdown instead
// (ProfileMenu, below).
const OPERATOR_PRIMARY_BASE = [
  { to: '/operator', label: 'Operator Console', icon: Wrench },
  { to: '/register-business', label: 'Register Business', icon: Store },
  { to: '/hire-people', label: 'Hire People', icon: Users },
  { to: '/visits', label: 'Verify a Visit', icon: BadgeCheck },
  { to: '/operator/waitlist', label: 'Waitlist & Offers', icon: Tag },
]
const OPERATOR_MORE = [
  { to: '/operator/revenue', label: 'Revenue Management', icon: IndianRupee },
  { to: '/operator/content-generator', label: 'Content Generator', icon: Megaphone },
  { to: '/operator/complaints', label: 'Raise a Complaint', icon: ClipboardList },
  { to: '/multimodal-agent', label: 'Multimodal Agent', icon: Bot },
]
// Authority nav split primary/more the same way Operator/Traveller's
// already is, for the same reason: a flat bar reads as a grab-bag, not a
// workflow. PRIMARY is "the job" -- the dashboard's own analytics, and
// Complaints (promoted out of being a dashboard tab now that travellers,
// operators, AND workers all file into the same moderation queue -- it's a
// standing workload, not one section among four), then Community Review
// (place-suggestion moderation, the other queue an authority clears).
// MORE is the anytime helper, same "closes out the list" placement every
// other role's nav already gives it.
const AUTHORITY_PRIMARY = [
  { to: '/authority', label: 'Authority Dashboard', icon: Landmark },
  { to: '/authority/complaints', label: 'Complaints', icon: ClipboardList },
  { to: '/community', label: 'Community Review', icon: ClipboardCheck },
]
const AUTHORITY_MORE = [
  { to: '/multimodal-agent', label: 'Multimodal Agent', icon: Bot },
]
// Worker role -- the narrowest nav of any role (worker-role-spec.md §01:
// "no dashboard full of KPIs. Just: be found, get offered work, do it, get
// rated"). Worker Console holds gigs/profile as its own internal tabs
// rather than separate nav entries, same consolidation OperatorConsole and
// AuthorityDashboard already use for closely related sub-views. My Jobs and
// Raise a Complaint live under More/the profile dropdown instead -- checked
// occasionally, not the tab a worker lands on.
const WORKER_PRIMARY = [
  { to: '/worker', label: 'Worker Console', icon: Briefcase },
]
const WORKER_MORE = [
  { to: '/worker/complaints', label: 'Raise a Complaint', icon: ClipboardList },
  { to: '/multimodal-agent', label: 'Multimodal Agent', icon: Bot },
]

// Shown next to the brand mark once logged in -- the account's own
// server-side role (never a frontend guess), so a traveller/operator/
// authority/worker always sees which one they're signed in as.
const ROLE_LABEL = { traveller: 'Traveller', operator: 'Operator', authority: 'Authority', worker: 'Worker' }

// Where the brand mark itself links to -- was hardcoded to '/home' (the
// traveller "Plan a trip" page) for every logged-in role, so clicking the
// Sahyatri logo as an operator or authority incorrectly bounced them into
// the traveller trip planner. Each role's own home base instead.
const ROLE_HOME = { operator: '/operator', authority: '/authority', worker: '/worker' }
function homeForRole(role) {
  return ROLE_HOME[role] || '/home'
}

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
  if (role === 'worker') return { primary: WORKER_PRIMARY, more: WORKER_MORE }
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

// Manual override of useDataSaverStore's own connection-based default --
// skips images below a bandwidth threshold, but the traveller can always
// turn it on/off themselves (e.g. a good connection right now despite a
// pilgrimage route that's usually patchy). Lives in the account menu since
// it's a standing preference, not a per-page setting.
function DataSaverToggle() {
  const enabled = useDataSaverStore((s) => s.enabled)
  const toggle = useDataSaverStore((s) => s.toggle)
  return (
    <button
      type="button"
      onClick={toggle}
      role="menuitemcheckbox"
      aria-checked={enabled}
      className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-ink/80 transition hover:bg-ink/5"
    >
      <span className="flex items-center gap-2"><ImageOff size={16} aria-hidden="true" /> Data saver</span>
      <span className={`flex h-5 w-9 items-center rounded-full p-0.5 transition ${enabled ? 'bg-ink justify-end' : 'bg-paper-dim justify-start'}`}>
        <span className="h-4 w-4 rounded-full bg-paper" />
      </span>
    </button>
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
          {authUser.role === 'traveller' && <NavLink to="/trips" label="My Trips" icon={Route} onClick={() => setOpen(false)} />}
          {authUser.role === 'worker' && <NavLink to="/worker/jobs" label="My Jobs" icon={ListChecks} onClick={() => setOpen(false)} />}
          {/* Operator: "Register Business" itself drops out of the main nav
              once at least one business is registered (navForRole's
              hasBusinesses flag -- it "did its job"), but an operator with
              more than one property still needs a way back to that form.
              Always present here, unlike the main nav entry. */}
          {authUser.role === 'operator' && <NavLink to="/register-business" label="Register a business" icon={Store} onClick={() => setOpen(false)} />}
          <DataSaverToggle />
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

const NOTIFICATION_POLL_MS = 15_000 // matches the operator/authority pages' own polling cadence

// One-line summary per notification type -- the full page (Notifications.jsx)
// still owns the complete card, source link, and accept/reject actions; this
// is deliberately a compact preview so the dropdown stays scannable, not a
// second copy of that page's logic.
function notificationSummary(n) {
  if (n.type === 'offer') {
    const offer = n.offer
    return {
      icon: Tag,
      tone: 'text-pressure bg-pressure/10',
      title: `Flash offer near ${getDestinationLabel(n.destId)}`,
      detail: offer ? `${offer.discountPct ? `${offer.discountPct}% off` : 'Discounted'} · ₹${offer.effectivePrice ?? offer.originalPrice}` : 'You were on the waitlist when this opened.',
    }
  }
  if (n.type === 'waitlist_fulfilled') {
    return {
      icon: CheckCircle2,
      tone: 'text-relief bg-relief/10',
      title: `Waitlist fulfilled near ${getDestinationLabel(n.destId)}`,
      detail: 'You claimed an offer here.',
    }
  }
  const severity = alertSeverity(n.severity)
  return {
    icon: Bell,
    tone: `${severity.tone === 'danger' ? 'text-pressure' : 'text-ink/70'} bg-ink/5`,
    title: `Update for your ${getDestinationLabel(n.destId)} trip`,
    detail: `${alertKindLabel(n.kind)} · ${n.body || ''}`,
  }
}

// Offer/waitlist_fulfilled notifications are about something claimable on
// the Offers & Waitlist page's own Offers tab -- clicking one there is more
// useful than landing on the full /notifications feed. Alerts have no such
// dedicated page of their own, so they keep going to /notifications.
function notificationLinkTo(n) {
  return n.type === 'offer' || n.type === 'waitlist_fulfilled' ? '/offers' : '/notifications'
}

// The bell lives in the header itself now (not a nav-menu entry) so the
// unread-style count is visible on every page, not just after navigating to
// /notifications -- polls the same three-source feed
// (alerts/offers/waitlist) Notifications.jsx's own full page reads,
// {silent} so the badge updates without flashing a loading state.
function NotificationBell() {
  const notifications = useNotificationsStore((state) => state.notifications)
  const unreadCount = useNotificationsStore((state) => state.unreadCount)
  const fetchNotifications = useNotificationsStore((state) => state.fetchNotifications)
  const markAllRead = useNotificationsStore((state) => state.markAllRead)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(() => fetchNotifications({ silent: true }), NOTIFICATION_POLL_MS)
    return () => clearInterval(interval)
  }, [fetchNotifications])

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
        onClick={() => {
          setOpen((v) => {
            const next = !v
            if (next) markAllRead() // opening the dropdown counts as "seen" -- badge clears immediately
            return next
          })
        }}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-ink/70 transition hover:bg-ink/5"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} new` : 'Notifications'}
      >
        <Bell size={19} aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-pressure px-1 text-[10px] font-bold leading-none text-paper">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div role="menu" className="glass-surface absolute right-0 z-20 mt-1 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl shadow-lg">
          <div className="border-b border-paper-dim px-3 py-2.5 text-sm font-semibold text-ink">Notifications</div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-ash">No updates right now.</p>
            ) : (
              notifications.slice(0, 8).map((n) => {
                const { icon: Icon, tone, title, detail } = notificationSummary(n)
                return (
                  <Link
                    key={n.id}
                    to={notificationLinkTo(n)}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-2.5 px-3 py-2.5 transition hover:bg-ink/5"
                  >
                    <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${tone}`}>
                      <Icon size={14} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-ink">{title}</span>
                      <span className="block truncate text-xs text-ash">{detail}</span>
                    </span>
                    <span className="shrink-0 text-[10px] text-ash">{timeAgo(n.sentAt)}</span>
                  </Link>
                )
              })
            )}
          </div>
          <Link
            to="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-paper-dim px-3 py-2.5 text-center text-xs font-semibold text-pressure hover:bg-pressure/5"
          >
            View all notifications
          </Link>
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
        <Link to={authUser ? homeForRole(authUser.role) : '/'} className="group flex shrink-0 items-center gap-2.5 text-ink">
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
          {authUser && <NotificationBell />}
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

        {/* Mobile: bell stays reachable even though the rest of the account
            cluster collapses into the sheet below, matching how it's always
            visible (not tucked into a menu) on desktop. */}
        <div className="flex items-center gap-2 md:hidden">
          {authUser && <NotificationBell />}
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="rounded-xl border border-paper-dim bg-white p-2.5 text-ink/70 shadow-sm hover:bg-paper-dim"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
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
              <>
                {authUser.role === 'traveller' && (
                  <button type="button" onClick={() => navigate('/trips')} className="mb-2 flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-sm font-medium text-ink/70">
                    <Route size={16} aria-hidden="true" /> My Trips
                  </button>
                )}
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
              </>
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
