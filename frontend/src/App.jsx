import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuthStore } from './store/useAuthStore'
import Header, { FullPageLoader } from './components/shell/Header'
import EmergencyBanner from './components/shell/EmergencyBanner'
import { Page, RequireAuth, RequireAuthBare, RequireRole } from './components/shell/Guards'

// Route-level code splitting: every screen below is its own chunk, fetched
// only when its route actually renders, instead of one bundle shipping
// every role's screens (worker console, authority dashboard, operator
// revenue tools, ...) to every visitor regardless of which one they'll
// ever use. AuthScreen/LandingPage are lazy too -- the one shared
// <Suspense> below covers the brief fetch with a real loading state
// instead of a blank screen, and it's a small one-time cost against
// shipping the entire app's code on first paint.
const AuthScreen = lazy(() => import('./components/auth/AuthScreen'))
const ForgotPassword = lazy(() => import('./components/auth/ForgotPassword'))
const ResetPassword = lazy(() => import('./components/auth/ResetPassword'))
const PressureHeatmap = lazy(() => import('./components/pressure/PressureHeatmap'))
const SwapPage = lazy(() => import('./components/swap').then((m) => ({ default: m.SwapPage })))
const TripConfirmation = lazy(() => import('./components/swap').then((m) => ({ default: m.TripConfirmation })))
const TripPlanner = lazy(() => import('./components/planner/TripPlanner'))
const DestinationDetail = lazy(() => import('./components/destinations/DestinationDetail'))
const MyTrips = lazy(() => import('./components/trips/MyTrips'))
const Profile = lazy(() => import('./components/profile/Profile'))
const OperatorConsole = lazy(() => import('./components/operator/OperatorConsole'))
const RegisterBusiness = lazy(() => import('./components/operator/RegisterBusiness'))
const HirePeople = lazy(() => import('./components/operator/HirePeople'))
const OperatorWaitlistOffers = lazy(() => import('./components/operator/OperatorWaitlistOffers'))
const OperatorAnalytics = lazy(() => import('./components/operator/OperatorAnalytics'))
const OperatorVerifyVisit = lazy(() => import('./components/operator/OperatorVerifyVisit'))
const ContentGenerator = lazy(() => import('./components/operator/ContentGenerator'))
const RevenueDashboard = lazy(() => import('./components/operator/RevenueDashboard'))
const OperatorComplaints = lazy(() => import('./components/operator/OperatorComplaints'))
const WorkerConsole = lazy(() => import('./components/worker/WorkerConsole'))
const WorkerMyJobs = lazy(() => import('./components/worker/WorkerMyJobs'))
const WorkerComplaints = lazy(() => import('./components/worker/WorkerComplaints'))
const AuthorityDashboard = lazy(() => import('./components/authority/dashboard/AuthorityDashboard'))
const AuthorityComplaints = lazy(() => import('./components/authority/moderation/AuthorityComplaints'))
const AuthorityAlerts = lazy(() => import('./components/authority/moderation/AuthorityAlerts'))
const VisitVerify = lazy(() => import('./components/trust/VisitVerify'))
const CommunitySubmit = lazy(() => import('./components/trust/community/CommunitySubmit'))
const CommunityReview = lazy(() => import('./components/trust/community/CommunityReview'))
const CommunityForum = lazy(() => import('./components/trust/community/CommunityForum'))
const OffersWaitlist = lazy(() => import('./components/trust/OffersWaitlist'))
const Alerts = lazy(() => import('./components/trust/safety/Alerts'))
const Safety = lazy(() => import('./components/trust/safety/Safety'))
const SharedTripView = lazy(() => import('./components/trust/safety/SharedTripView'))
const Businesses = lazy(() => import('./components/trust/Businesses'))
const AvailableServices = lazy(() => import('./components/trust/AvailableServices'))
const Notifications = lazy(() => import('./components/trust/Notifications'))
const MapPreview = lazy(() => import('./pages/MapPreview'))
const LandingPage = lazy(() => import('./pages/LandingPage'))
const MultimodalTravelAgent = lazy(() => import('./components/ai/MultimodalTravelAgent'))
const TravelTogether = lazy(() => import('./components/groups/TravelTogether'))
const GroupTripDetail = lazy(() => import('./components/groups/GroupTripDetail'))

// Where each role lands after authenticating (auth spec §7/§20) -- mirrors
// AuthScreen's own ROLE_HOME, used here for the post-refresh/direct-URL
// case (AuthScreen only handles the moment of submitting the login form).
const ROLE_HOME = { traveller: '/home', operator: '/operator', authority: '/authority', worker: '/worker' }
const roleHome = (authUser) => ROLE_HOME[authUser?.role] || '/home'

// Sahyatri's application shell (§53-58 of the frontend spec): a public
// experience (landing/signin, signup, explore, destination detail,
// businesses, and the auth-recovery pages) and an authenticated experience
// behind a persistent header/nav that exposes every implemented feature --
// nothing reachable only via a hidden URL. Role-specific routes
// (operator/authority) are gated in the UI only; the backend remains the
// real authority on every call these pages make (§56).
function App() {
  const authUser = useAuthStore((state) => state.authUser)
  const isCheckingAuth = useAuthStore((state) => state.isCheckingAuth)
  const checkAuth = useAuthStore((state) => state.checkAuth)

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  if (isCheckingAuth) return <FullPageLoader />

  return (
    <BrowserRouter>
      <div className="flex min-h-screen flex-col bg-paper">
        <EmergencyBanner />
        <Header />
        <Suspense fallback={<FullPageLoader />}>
        <Routes>
          {/* Public experience (§53). "/" is now a proper landing page
              describing the product -- sign-in stays its own screen at
              /signin, unchanged, so existing links to it keep working. */}
          <Route path="/" element={authUser ? <Navigate to={roleHome(authUser)} replace /> : <LandingPage />} />
          <Route path="/signin" element={authUser ? <Navigate to={roleHome(authUser)} replace /> : <AuthScreen mode="login" />} />
          <Route path="/signup" element={authUser ? <Navigate to={roleHome(authUser)} replace /> : <AuthScreen mode="signup" />} />
          {/* Auth-recovery routes are never gated on auth state (§19: "Do
              not protect public authentication routes unnecessarily") -- a
              logged-in user following a stale reset link from an old email
              should still be able to use it. */}
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/explore" element={<Page wide><PressureHeatmap /></Page>} />
          <Route path="/explore/:destId" element={<Page><DestinationDetail /></Page>} />
          <Route path="/businesses" element={<Page><Businesses /></Page>} />
          {/* Public safety advisory read (spec §3.3) -- also reachable from
              the authenticated nav, same page either way. */}
          <Route path="/alerts" element={<Page><Alerts /></Page>} />
          {/* Public Shareable Trip Record viewer (spec §5) -- no account
              needed, matching the backend's own GET (no protectRoute). */}
          <Route path="/trip/share/:token" element={<Page><SharedTripView /></Page>} />

          {/* Authenticated experience (§57/§58) */}
          <Route path="/home" element={<RequireAuth wide><TripPlanner /></RequireAuth>} />
          <Route path="/multimodal-agent" element={<RequireAuth wide><MultimodalTravelAgent /></RequireAuth>} />
          {/* RequireAuthBare, not RequireAuth: the map is a full-bleed canvas
              (near-full-viewport, its own <main>), not the standard
              max-w-6xl centred page shell RequireAuth would force it into. */}
          <Route path="/map" element={<RequireAuthBare><MapPreview /></RequireAuthBare>} />
          <Route path="/trips" element={<RequireAuth><MyTrips /></RequireAuth>} />
          <Route path="/swap" element={<RequireAuthBare><SwapPage /></RequireAuthBare>} />
          <Route path="/trip-confirmation" element={<RequireAuthBare><TripConfirmation /></RequireAuthBare>} />
          {/* Same URL, role-branched: an operator's "Verify a Visit" means
              displaying the live rotating code (OperatorVerifyVisit), not
              submitting one -- travellers/authorities get the original
              code-entry form (VisitVerify) unchanged. */}
          <Route path="/visits" element={<RequireAuth>{authUser?.role === 'operator' ? <OperatorVerifyVisit /> : <VisitVerify />}</RequireAuth>} />
          <Route path="/register-business" element={<RequireRole role="operator"><RegisterBusiness /></RequireRole>} />
          <Route path="/hire-people" element={<RequireRole role="operator"><HirePeople /></RequireRole>} />
          <Route path="/operator/waitlist" element={<RequireRole role="operator"><OperatorWaitlistOffers /></RequireRole>} />
          <Route path="/operator/analytics" element={<RequireRole role="operator"><OperatorAnalytics /></RequireRole>} />
          <Route path="/operator/content-generator" element={<RequireRole role="operator"><ContentGenerator /></RequireRole>} />
          <Route path="/operator/revenue" element={<RequireRole role="operator" wide><RevenueDashboard /></RequireRole>} />
          <Route path="/operator/complaints" element={<RequireRole role="operator"><OperatorComplaints /></RequireRole>} />
          {/* Back-compat: Post a Gig used to be its own route -- now a tab
              inside Hire People (HirePeople.jsx), same URL a stale
              bookmark/link would have. */}
          <Route path="/operator/post-gig" element={<Navigate to="/hire-people" replace />} />
          <Route path="/worker" element={<RequireRole role="worker" wide><WorkerConsole /></RequireRole>} />
          <Route path="/worker/jobs" element={<RequireRole role="worker"><WorkerMyJobs /></RequireRole>} />
          <Route path="/worker/complaints" element={<RequireRole role="worker"><WorkerComplaints /></RequireRole>} />
          {/* Same URL, role-branched (§14-19): travellers get "Suggest a
              Place" (CommunitySubmit), authorities get the "Community
              Review" moderation UI (CommunityReview) -- both nav entries
              point here. The backend endpoints each one calls remain the
              real authorization boundary (review/queue endpoints already
              403 anyone whose server-side role isn't "authority"), so this
              branch is a UI convenience, not a security control. */}
          <Route path="/community" element={<RequireAuth wide>{authUser?.role === 'authority' ? <CommunityReview /> : <CommunitySubmit />}</RequireAuth>} />
          <Route path="/forum" element={<RequireAuth><CommunityForum /></RequireAuth>} />
          <Route path="/services" element={<RequireAuth><AvailableServices /></RequireAuth>} />
          <Route path="/notifications" element={<RequireAuth><Notifications /></RequireAuth>} />
          <Route path="/offers" element={<RequireAuth><OffersWaitlist /></RequireAuth>} />
          <Route path="/safety" element={<RequireAuth><Safety /></RequireAuth>} />
          <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
          {/* Group Travel (Revised Implementation Plan §16) -- open to
              every authenticated role, same posture as My Trips; the
              backend's own auth-required reads/writes remain the real
              authorization boundary. */}
          <Route path="/travel-together" element={<RequireAuth><TravelTogether /></RequireAuth>} />
          <Route path="/travel-together/groups/:id" element={<RequireAuth><GroupTripDetail /></RequireAuth>} />

          {/* Role-specific (§56) */}
          <Route path="/operator" element={<RequireRole role="operator" wide><OperatorConsole /></RequireRole>} />
          <Route path="/authority" element={<RequireRole role="authority" wide><AuthorityDashboard /></RequireRole>} />
          <Route path="/authority/complaints" element={<RequireRole role="authority"><AuthorityComplaints /></RequireRole>} />
          <Route path="/authority/alerts" element={<RequireRole role="authority"><AuthorityAlerts /></RequireRole>} />

          {/* Back-compat redirects for pre-rebuild URLs */}
          <Route path="/login" element={<Navigate to="/signin" replace />} />
          <Route path="/pressure" element={<Navigate to="/explore" replace />} />
          <Route path="/planner" element={<Navigate to="/home" replace />} />
          <Route path="/map-preview" element={<Navigate to="/map" replace />} />
          {/* Email verification was removed -- redirect any stale link
              (an old email, a bookmark) somewhere real instead of 404ing. */}
          <Route path="/verify-email" element={<Navigate to="/signin" replace />} />

          <Route path="*" element={<Navigate to={authUser ? roleHome(authUser) : '/'} replace />} />
        </Routes>
        </Suspense>
      </div>
    </BrowserRouter>
  )
}

export default App
