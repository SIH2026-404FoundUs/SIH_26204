import { UserRound } from 'lucide-react'
import { useAuthStore } from '../../store/useAuthStore'
import PageHeader from '../ui/PageHeader'
import AccountCard from './AccountCard'
import PreferencesCard from './PreferencesCard'
import TravellerTripsCard from './TravellerTripsCard'
import OperatorBusinessesCard from './OperatorBusinessesCard'
import AuthorityQueueCard from './AuthorityQueueCard'
import WorkerSnapshotCard from './WorkerSnapshotCard'
import ChangePasswordCard from './ChangePasswordCard'

// The page itself only wires auth state to its sections -- each section
// fetches what it needs from the props/store it's given, so this file stays
// a thin composition root rather than a monolith owning every section's
// markup and data-fetching at once.
//
// Every role used to get the exact same two sections here (AccountCard +
// ChangePasswordCard) regardless of what they actually do on the platform
// -- honest for account details, but genuinely vague otherwise: an operator
// running three businesses and a worker with a 5-star rating both saw a
// page that looked identical to a brand-new signup. Each role now gets one
// additional section that's real, live, role-specific data already
// fetched elsewhere in the app (never a duplicate editable form -- editing
// still happens at each feature's own page; this is a live snapshot with a
// link there):
//   traveller -- travel preferences (unchanged, this already existed)
//   operator  -- your registered businesses (OperatorBusinessesCard)
//   authority -- your review queue: pending complaints + submissions (AuthorityQueueCard)
//   worker    -- your worker profile: skills, rating, verification (WorkerSnapshotCard)
const ROLE_DESCRIPTION = {
  traveller: 'Your account details and travel preferences.',
  operator: 'Your account details and registered businesses.',
  authority: 'Your account details and review queue.',
  worker: 'Your account details and worker profile.',
}

export default function Profile() {
  const authUser = useAuthStore((state) => state.authUser)
  const logout = useAuthStore((state) => state.logout)

  if (!authUser) return null

  return (
    <div>
      <PageHeader
        icon={UserRound}
        title="Profile"
        description={ROLE_DESCRIPTION[authUser.role] || 'Your account details.'}
      />
      <AccountCard authUser={authUser} onLogout={logout} />
      {authUser.role === 'traveller' && <TravellerTripsCard />}
      {authUser.role === 'traveller' && <PreferencesCard userId={authUser._id} />}
      {authUser.role === 'operator' && <OperatorBusinessesCard />}
      {authUser.role === 'authority' && <AuthorityQueueCard />}
      {authUser.role === 'worker' && <WorkerSnapshotCard />}
      <ChangePasswordCard />
    </div>
  )
}
