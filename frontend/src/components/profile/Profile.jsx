import { UserRound } from 'lucide-react'
import { useAuthStore } from '../../store/useAuthStore'
import PageHeader from '../ui/PageHeader'
import AccountCard from './AccountCard'
import PreferencesCard from './PreferencesCard'
import QuickLinksCard from './QuickLinksCard'

// The page itself only wires auth state to its sections -- each section
// fetches (PreferencesCard) or derives (QuickLinksCard) what it needs from
// the props it's given, so this file stays a thin composition root rather
// than a monolith owning every section's markup and data-fetching at once.
export default function Profile() {
  const authUser = useAuthStore((state) => state.authUser)
  const logout = useAuthStore((state) => state.logout)

  if (!authUser) return null

  return (
    <div>
      <PageHeader icon={UserRound} title="Profile" description="Your account, preferences, and everything else you have access to." />
      <AccountCard authUser={authUser} onLogout={logout} />
      <QuickLinksCard role={authUser.role} />
      <PreferencesCard userId={authUser._id} />
    </div>
  )
}
