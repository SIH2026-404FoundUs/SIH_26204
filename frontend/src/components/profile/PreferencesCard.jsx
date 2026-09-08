import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../../lib/api'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import Alert from '../ui/Alert'
import LoadingState from '../ui/LoadingState'

// Self-contained: fetches its own data (GET /api/v1/users/:id/preferences --
// the same one the ai-service's agent tools use) rather than the parent page
// having to know this section's data needs. Not a settings *form* -- this
// app has nowhere to persist edits to these fields yet, so it stays a
// read-only, honestly-empty-when-empty display rather than inventing a save
// button that doesn't do anything.
export default function PreferencesCard({ userId }) {
  const [preferences, setPreferences] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    async function loadPreferences() {
      setIsLoading(true)
      try {
        const res = await api.get(`/v1/users/${userId}/preferences`)
        if (!cancelled) setPreferences(res.data)
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load your preferences'))
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    loadPreferences()
    return () => { cancelled = true }
  }, [userId])

  const interestEntries = Object.entries(preferences?.interests || {})

  return (
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
  )
}
