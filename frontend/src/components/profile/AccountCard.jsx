import { LogOut, Mail, ShieldCheck, UserRound } from 'lucide-react'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import Button from '../ui/Button'

// Identity + the one account-level action (logout) -- kept separate from
// PreferencesCard/QuickLinksCard so each section can be dropped, reordered,
// or reused (e.g. a smaller version in a header dropdown) independently.
export default function AccountCard({ authUser, onLogout }) {
  return (
    <Card className="mb-4">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ink text-paper">
          <UserRound size={22} aria-hidden="true" />
        </span>
        <div>
          <p className="font-display text-lg text-ink">{authUser.fullName}</p>
          <p className="flex items-center gap-1.5 text-sm text-ash"><Mail size={13} aria-hidden="true" /> {authUser.email}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge tone="info" icon={ShieldCheck}>{authUser.role}</Badge>
          {authUser.phone && <span className="text-xs text-ash">{authUser.phone}</span>}
        </div>
        <Button variant="ghost" size="sm" icon={LogOut} onClick={onLogout}>Log out</Button>
      </div>
    </Card>
  )
}
