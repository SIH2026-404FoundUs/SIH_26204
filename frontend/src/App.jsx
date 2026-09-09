import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuthStore } from './store/useAuthStore'
import Header, { FullPageLoader } from './components/shell/Header'
import { Page, RequireAuth, RequireAuthBare, RequireRole } from './components/shell/Guards'
import AuthScreen from './components/auth/AuthScreen'
import ForgotPassword from './components/auth/ForgotPassword'
import ResetPassword from './components/auth/ResetPassword'
import PressureHeatmap from './components/pressure/PressureHeatmap'
import { SwapPage, TripConfirmation } from './components/swap'
import TripPlanner from './components/planner/TripPlanner'
import DestinationDetail from './components/destinations/DestinationDetail'
import MyTrips from './components/trips/MyTrips'
import Profile from './components/profile/Profile'
import OperatorConsole from './components/operator/OperatorConsole'
import RegisterBusiness from './components/operator/RegisterBusiness'
import HirePeople from './components/operator/HirePeople'
import OperatorWaitlistOffers from './components/operator/OperatorWaitlistOffers'
import OperatorAnalytics from './components/operator/OperatorAnalytics'
import OperatorVerifyVisit from './components/operator/OperatorVerifyVisit'
import AuthorityDashboard from './components/authority/AuthorityDashboard'
import VisitVerify from './components/trust/VisitVerify'
import CommunitySubmit from './components/trust/CommunitySubmit'
import CommunityReview from './components/trust/CommunityReview'
import CommunityForum from './components/trust/CommunityForum'
import OffersWaitlist from './components/trust/OffersWaitlist'
import Alerts from './components/trust/Alerts'
import Safety from './components/trust/Safety'
import Businesses from './components/trust/Businesses'
import AvailableServices from './components/trust/AvailableServices'
import Notifications from './components/trust/Notifications'
import MapPreview from './pages/MapPreview'
import LandingPage from './pages/LandingPage'

// Where each role lands after authenticating (auth spec §7/§20) -- mirrors
// AuthScreen's own ROLE_HOME, used here for the post-refresh/direct-URL
// case (AuthScreen only handles the moment of submitting the login form).
const ROLE_HOME = { traveller: '/home', operator: '/operator', authority: '/authority' }
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
        <Header />
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

          {/* Authenticated experience (§57/§58) */}
          <Route path="/home" element={<RequireAuth wide><TripPlanner /></RequireAuth>} />
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
          {/* Same URL, role-branched (§14-19): travellers get "Suggest a
              Place" (CommunitySubmit), authorities get the "Community
              Review" moderation UI (CommunityReview) -- both nav entries
              point here. The backend endpoints each one calls remain the
              real authorization boundary (review/queue endpoints already
              403 anyone whose server-side role isn't "authority"), so this
              branch is a UI convenience, not a security control. */}
          <Route path="/community" element={<RequireAuth>{authUser?.role === 'authority' ? <CommunityReview /> : <CommunitySubmit />}</RequireAuth>} />
          <Route path="/forum" element={<RequireAuth><CommunityForum /></RequireAuth>} />
          <Route path="/services" element={<RequireAuth><AvailableServices /></RequireAuth>} />
          <Route path="/notifications" element={<RequireAuth><Notifications /></RequireAuth>} />
          <Route path="/offers" element={<RequireAuth><OffersWaitlist /></RequireAuth>} />
          <Route path="/safety" element={<RequireAuth><Safety /></RequireAuth>} />
          <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />

          {/* Role-specific (§56) */}
          <Route path="/operator" element={<RequireRole role="operator"><OperatorConsole /></RequireRole>} />
          <Route path="/authority" element={<RequireRole role="authority" wide><AuthorityDashboard /></RequireRole>} />

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
      </div>
    </BrowserRouter>
  )
}

export default App
