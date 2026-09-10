import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import api, { getErrorMessage } from '../../lib/api'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Alert from '../ui/Alert'
import LoadingState from '../ui/LoadingState'
import FormField, { inputClass } from '../ui/FormField'

const BUDGET_BANDS = ['low', 'medium', 'high']
const DEFAULT_INTEREST_WEIGHT = 0.7

// Editable travel preferences -- loads the existing GET
// /api/v1/users/:id/preferences (same one the ai-service's agent tools
// read) and saves through the new PATCH /api/v1/users/:id/preferences
// (self-only, allow-listed to exactly these three fields the schema
// already defines). `interests` stays the existing {key: weight} shape --
// there's no fixed interest vocabulary anywhere in this codebase to pick
// from, so travellers add/remove free-form interest tags rather than
// picking from a list this app doesn't actually define.
export default function PreferencesCard({ userId }) {
  const [preferences, setPreferences] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const [editing, setEditing] = useState(false)
  const [interests, setInterests] = useState({})
  const [budgetBand, setBudgetBand] = useState('')
  const [languages, setLanguages] = useState([])
  const [newInterest, setNewInterest] = useState('')
  const [newLanguage, setNewLanguage] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    async function loadPreferences() {
      setIsLoading(true)
      try {
        const res = await api.get(`/v1/users/${userId}/preferences`)
        if (!cancelled) {
          setPreferences(res.data)
          setInterests(res.data?.interests || {})
          setBudgetBand(res.data?.budgetBand || '')
          setLanguages(res.data?.languages || [])
        }
      } catch (err) {
        if (!cancelled) setLoadError(getErrorMessage(err, 'Could not load your preferences'))
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    loadPreferences()
    return () => { cancelled = true }
  }, [userId])

  function startEditing() {
    setInterests(preferences?.interests || {})
    setBudgetBand(preferences?.budgetBand || '')
    setLanguages(preferences?.languages || [])
    setFeedback(null)
    setEditing(true)
  }

  function addInterest() {
    const key = newInterest.trim().toLowerCase()
    if (!key || interests[key] !== undefined) { setNewInterest(''); return }
    setInterests((prev) => ({ ...prev, [key]: DEFAULT_INTEREST_WEIGHT }))
    setNewInterest('')
  }

  function removeInterest(key) {
    setInterests((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function addLanguage() {
    const lang = newLanguage.trim()
    if (!lang || languages.includes(lang)) { setNewLanguage(''); return }
    setLanguages((prev) => [...prev, lang])
    setNewLanguage('')
  }

  function removeLanguage(lang) {
    setLanguages((prev) => prev.filter((l) => l !== lang))
  }

  async function handleSave(e) {
    e.preventDefault()
    setIsSaving(true)
    setFeedback(null)
    try {
      const res = await api.patch(`/v1/users/${userId}/preferences`, { interests, budgetBand, languages })
      setPreferences(res.data)
      setFeedback({ tone: 'success', message: 'Preferences saved.' })
      setEditing(false)
    } catch (err) {
      setFeedback({ tone: 'error', message: getErrorMessage(err, 'Could not save your preferences') })
    } finally {
      setIsSaving(false)
    }
  }

  const interestEntries = Object.entries(preferences?.interests || {})

  return (
    <Card className="mb-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Travel preferences</h2>
        {!isLoading && !loadError && !editing && (
          <Button variant="ghost" size="sm" onClick={startEditing}>Edit</Button>
        )}
      </div>

      {loadError && <Alert tone="error">{loadError}</Alert>}
      {isLoading && !loadError && <LoadingState label="Loading preferences…" />}

      {!isLoading && !loadError && !editing && (
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
              <p className="text-ink/50">No interests saved yet.</p>
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

      {!isLoading && !loadError && editing && (
        <form onSubmit={handleSave} className="space-y-4">
          <FormField label="Budget band">
            <select value={budgetBand} onChange={(e) => setBudgetBand(e.target.value)} className={inputClass}>
              <option value="">Not set</option>
              {BUDGET_BANDS.map((band) => (
                <option key={band} value={band}>{band}</option>
              ))}
              {budgetBand && !BUDGET_BANDS.includes(budgetBand) && <option value={budgetBand}>{budgetBand}</option>}
            </select>
          </FormField>

          <FormField label="Languages">
            <div className="space-y-2">
              {languages.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {languages.map((lang) => (
                    <span key={lang} className="inline-flex items-center gap-1 rounded-full bg-paper-dim px-2.5 py-0.5 text-xs font-medium text-ink/70">
                      {lang}
                      <button type="button" onClick={() => removeLanguage(lang)} aria-label={`Remove ${lang}`} className="text-ink/50 hover:text-ink">
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  value={newLanguage}
                  onChange={(e) => setNewLanguage(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLanguage() } }}
                  placeholder="e.g. Hindi"
                  className={inputClass}
                />
                <Button type="button" variant="outline" size="sm" onClick={addLanguage}>Add</Button>
              </div>
            </div>
          </FormField>

          <FormField label="Interests">
            <div className="space-y-2">
              {Object.keys(interests).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(interests).map(([key, value]) => (
                    <span key={key} className="inline-flex items-center gap-1 rounded-full bg-paper-dim px-2.5 py-0.5 text-xs font-medium text-ink/70">
                      {key} &middot; {typeof value === 'number' ? value.toFixed(2) : String(value)}
                      <button type="button" onClick={() => removeInterest(key)} aria-label={`Remove ${key}`} className="text-ink/50 hover:text-ink">
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  value={newInterest}
                  onChange={(e) => setNewInterest(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addInterest() } }}
                  placeholder="e.g. trekking"
                  className={inputClass}
                />
                <Button type="button" variant="outline" size="sm" onClick={addInterest}>Add</Button>
              </div>
            </div>
          </FormField>

          {feedback && <Alert tone={feedback.tone}>{feedback.message}</Alert>}

          <div className="flex gap-2">
            <Button type="submit" variant="primary" loading={isSaving}>Save</Button>
            <Button type="button" variant="ghost" onClick={() => { setEditing(false); setFeedback(null) }}>Cancel</Button>
          </div>
        </form>
      )}

      {!editing && feedback && <div className="mt-3"><Alert tone={feedback.tone}>{feedback.message}</Alert></div>}
    </Card>
  )
}
