import { useEffect, useState } from 'react'
import { LogOut, Mail, ShieldCheck, UserRound } from 'lucide-react'
import { useAuthStore } from '../../store/useAuthStore'
import api, { getErrorMessage } from '../../lib/api'
import PageHeader from '../ui/PageHeader'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Alert from '../ui/Alert'
import LoadingState from '../ui/LoadingState'

// Reads the real GET /api/v1/users/:id/preferences endpoint -- the same one
// the ai-service's agent tools use -- rather than inventing a settings form
// this app can't actually persist anywhere yet.
export default function Profile() {
  const authUser = useAuthStore((state) => state.authUser)
  const logout = useAuthStore((state) => state.logout)
  const [preferences, setPreferences] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!authUser?._id) return
    let cancelled = false
    setIsLoading(true)
    api.get(`/v1/users/${authUser._id}/preferences`)
      .then((res) => { if (!cancelled) setPreferences(res.data) })
      .catch((err) => { if (!cancelled) setError(getErrorMessage(err, 'Could not load your preferences')) })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [authUser?._id])

  if (!authUser) return null
  const interestEntries = Object.entries(preferences?.interests || {})

  return (
    <div>
      <PageHeader icon={UserRound} title="Profile" description="Your account and saved preferences." />

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
        <div className="mt-4 flex items-center gap-2">
          <Badge tone="info" icon={ShieldCheck}>{authUser.role}</Badge>
          {authUser.phone && <span className="text-xs text-ash">{authUser.phone}</span>}
        </div>
      </Card>

      <Card className="mb-4">
        <h2 className="mb-3 text-sm font-semibold text-ink">Preferences</h2>
        {error && <Alert tone="error">{error}</Alert>}
        {isLoading && !error && <LoadingState label="Loading preferences…" />}
        {!isLoading && !error && (
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-ash">Budget band: </span>
              <span className="text-ink">{preferences?.budgetBand || 'Not set'}</span>
            </div>
            <div>
              <span className="text-ash">Languages: </span>
              <span className="text-ink">{preferences?.languages?.length ? preferences.languages.join(', ') : 'Not set'}</span>
            </div>
            <div>
              <span className="mb-1.5 block text-ash">Interests</span>
              {interestEntries.length === 0 ? (
                <p className="text-ink/50">No interest weights saved yet.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {interestEntries.map(([key, value]) => (
                    <Badge key={key} tone="neutral">{key} &middot; {typeof value === 'number' ? value.toFixed(2) : String(value)}</Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      <Button variant="outline" icon={LogOut} onClick={logout}>Log out</Button>
    </div>
  )
}
