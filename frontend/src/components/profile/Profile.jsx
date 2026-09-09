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
export default function Profile() {
  const authUser = useAuthStore((state) => state.authUser)
  const logout = useAuthStore((state) => state.logout)

  if (!authUser) return null

  return (
    <div>
      <PageHeader icon={UserRound} title="Profile" description="Your account details and travel preferences." />
      <AccountCard authUser={authUser} onLogout={logout} />
      <PreferencesCard userId={authUser._id} />
      <ChangePasswordCard />
    </div>
  )
}
