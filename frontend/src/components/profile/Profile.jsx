import { UserRound } from 'lucide-react'
import { useAuthStore } from '../../store/useAuthStore'
import PageHeader from '../ui/PageHeader'
import AccountCard from './AccountCard'
import PreferencesCard from './PreferencesCard'
import ChangePasswordCard from './ChangePasswordCard'

// The page itself only wires auth state to its sections -- each section
// fetches (PreferencesCard) what it needs from the props it's given, so this
// file stays a thin composition root rather than a monolith owning every
// section's markup and data-fetching at once.
// QuickLinksCard removed per spec: Profile focuses on account details +
// preferences + editing/saving, not a shortcut grid.
// Travel preferences (interests/budget/languages) are a traveller-only
// concept -- an operator's profile is account details + password only, same
// AccountCard/ChangePasswordCard components, just without a section that
// wouldn't mean anything for a business account.
export default function Profile() {
  const authUser = useAuthStore((state) => state.authUser)
  const logout = useAuthStore((state) => state.logout)

  if (!authUser) return null

  const isTraveller = authUser.role === 'traveller'

  return (
    <div>
      <PageHeader
        icon={UserRound}
        title="Profile"
        description={isTraveller ? 'Your account details and travel preferences.' : 'Your account details.'}
      />
      <AccountCard authUser={authUser} onLogout={logout} />
      {isTraveller && <PreferencesCard userId={authUser._id} />}
      <ChangePasswordCard />
    </div>
  )
}
