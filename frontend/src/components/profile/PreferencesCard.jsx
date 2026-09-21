import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import api, { getErrorMessage } from '../../lib/api'
import { useTravelTypesTaxonomy, activityLabel, paceLabel } from '../../lib/travelTypes'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Alert from '../ui/Alert'
import LoadingState from '../ui/LoadingState'
import FormField, { inputClass } from '../ui/FormField'

const BUDGET_BANDS = ['low', 'medium', 'high']
const DEFAULT_INTEREST_WEIGHT = 0.7

function ChipToggle({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        active ? 'border-ink bg-ink text-paper' : 'border-paper-dim bg-white text-ink/70 hover:border-ink/40'
      }`}
    >
      {children}
    </button>
  )
}

// Editable travel preferences -- loads the existing GET
// /api/v1/users/:id/preferences (same one the ai-service's agent tools
// read) and saves through PATCH /api/v1/users/:id/preferences (self-only,
// allow-listed server-side). Extended with Travel Types (Revised
// Implementation Plan §6): the SAME preferences subdocument, not a
// separate store/page -- interests/budgetBand/languages behave exactly as
// before, the new structured fields are additive.
export default function PreferencesCard({ userId }) {
  const taxonomy = useTravelTypesTaxonomy()
  const [preferences, setPreferences] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const [editing, setEditing] = useState(false)
  const [interests, setInterests] = useState({})
  const [budgetBand, setBudgetBand] = useState('')
  const [languages, setLanguages] = useState([])
  const [newInterest, setNewInterest] = useState('')
  const [newLanguage, setNewLanguage] = useState('')

  const [travelTypes, setTravelTypes] = useState([])
  const [preferredActivities, setPreferredActivities] = useState([])
  const [preferredPace, setPreferredPace] = useState('')
  const [budgetMin, setBudgetMin] = useState('')
  const [budgetMax, setBudgetMax] = useState('')
  const [preferredGroupSize, setPreferredGroupSize] = useState('')
  const [preferredTripDuration, setPreferredTripDuration] = useState('')
  const [openToGroupTravel, setOpenToGroupTravel] = useState(false)
  const [openToCaptainLedTrips, setOpenToCaptainLedTrips] = useState(false)

  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)

  function applyFromServer(data) {
    setPreferences(data)
    setInterests(data?.interests || {})
    setBudgetBand(data?.budgetBand || '')
    setLanguages(data?.languages || [])
    setTravelTypes(data?.travelTypes || [])
    setPreferredActivities(data?.preferredActivities || [])
    setPreferredPace(data?.preferredPace || '')
    setBudgetMin(data?.budgetRange?.min ?? '')
    setBudgetMax(data?.budgetRange?.max ?? '')
    setPreferredGroupSize(data?.preferredGroupSize || '')
    setPreferredTripDuration(data?.preferredTripDuration || '')
    setOpenToGroupTravel(Boolean(data?.openToGroupTravel))
    setOpenToCaptainLedTrips(Boolean(data?.openToCaptainLedTrips))
  }

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    async function loadPreferences() {
      setIsLoading(true)
      try {
        const res = await api.get(`/v1/users/${userId}/preferences`)
        if (!cancelled) applyFromServer(res.data)
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
    applyFromServer(preferences)
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

  function toggleTravelType(id) {
    setTravelTypes((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]))
  }

  function toggleActivity(id) {
    setPreferredActivities((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]))
  }

  async function handleSave(e) {
    e.preventDefault()
    setIsSaving(true)
    setFeedback(null)
    try {
      const res = await api.patch(`/v1/users/${userId}/preferences`, {
        interests, budgetBand, languages,
        travelTypes, preferredActivities,
        preferredPace: preferredPace || null,
        budgetRange: { min: budgetMin === '' ? null : Number(budgetMin), max: budgetMax === '' ? null : Number(budgetMax) },
        preferredGroupSize: preferredGroupSize || null,
        preferredTripDuration: preferredTripDuration || null,
        openToGroupTravel,
        openToCaptainLedTrips,
      })
      applyFromServer(res.data)
      setFeedback({ tone: 'success', message: 'Preferences saved.' })
      setEditing(false)
    } catch (err) {
      setFeedback({ tone: 'error', message: getErrorMessage(err, 'Could not save your preferences') })
    } finally {
      setIsSaving(false)
    }
  }

  const interestEntries = Object.entries(preferences?.interests || {})
  const travelTypeLabel = (id) => taxonomy.travelTypes.find((t) => t.id === id)?.label || id

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
            <span className="mb-1.5 block text-ash">Travel style</span>
            {preferences?.travelTypes?.length ? (
              <div className="flex flex-wrap gap-1.5">
                {preferences.travelTypes.map((t) => <Badge key={t} tone="info">{travelTypeLabel(t)}</Badge>)}
              </div>
            ) : <p className="text-ink/50">Not set</p>}
          </div>
          <div>
            <span className="mb-1.5 block text-ash">Activities</span>
            {preferences?.preferredActivities?.length ? (
              <div className="flex flex-wrap gap-1.5">
                {preferences.preferredActivities.map((a) => <Badge key={a} tone="neutral">{activityLabel(a)}</Badge>)}
              </div>
            ) : <p className="text-ink/50">Not set</p>}
          </div>
          <div>
            <span className="text-ash">Pace: </span>
            <span className="text-ink">{preferences?.preferredPace ? paceLabel(preferences.preferredPace) : 'Not set'}</span>
          </div>
          <div>
            <span className="text-ash">Budget range: </span>
            <span className="text-ink">
              {preferences?.budgetRange?.min != null || preferences?.budgetRange?.max != null
                ? `₹${preferences.budgetRange.min ?? '?'}–${preferences.budgetRange.max ?? '?'}`
                : 'Not set'}
            </span>
          </div>
          <div>
            <span className="text-ash">Group size: </span>
            <span className="text-ink">{preferences?.preferredGroupSize || 'Not set'}</span>
            <span className="ml-4 text-ash">Trip length: </span>
            <span className="text-ink">{preferences?.preferredTripDuration ? `${preferences.preferredTripDuration} days` : 'Not set'}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {preferences?.openToGroupTravel && <Badge tone="success">Open to group travel</Badge>}
            {preferences?.openToCaptainLedTrips && <Badge tone="success">Open to captain-led trips</Badge>}
          </div>
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
          <FormField label="Travel style" optional hint="Pick as many as fit">
            <div className="flex flex-wrap gap-2">
              {taxonomy.travelTypes.map((t) => (
                <ChipToggle key={t.id} active={travelTypes.includes(t.id)} onClick={() => toggleTravelType(t.id)}>{t.label}</ChipToggle>
              ))}
            </div>
          </FormField>

          <FormField label="Activities" optional>
            <div className="flex flex-wrap gap-2">
              {taxonomy.preferredActivities.map((a) => (
                <ChipToggle key={a} active={preferredActivities.includes(a)} onClick={() => toggleActivity(a)}>{activityLabel(a)}</ChipToggle>
              ))}
            </div>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Pace" optional>
              <select value={preferredPace} onChange={(e) => setPreferredPace(e.target.value)} className={inputClass}>
                <option value="">Not set</option>
                {taxonomy.preferredPace.map((p) => <option key={p} value={p}>{paceLabel(p)}</option>)}
              </select>
            </FormField>
            <FormField label="Group size" optional>
              <select value={preferredGroupSize} onChange={(e) => setPreferredGroupSize(e.target.value)} className={inputClass}>
                <option value="">Not set</option>
                {taxonomy.preferredGroupSize.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Budget range (INR)" optional>
              <div className="flex items-center gap-2">
                <input type="number" min="0" placeholder="Min" value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} className={inputClass} />
                <input type="number" min="0" placeholder="Max" value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} className={inputClass} />
              </div>
            </FormField>
            <FormField label="Trip duration" optional>
              <select value={preferredTripDuration} onChange={(e) => setPreferredTripDuration(e.target.value)} className={inputClass}>
                <option value="">Not set</option>
                {taxonomy.preferredTripDuration.map((d) => <option key={d} value={d}>{d} days</option>)}
              </select>
            </FormField>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-ink/80">
              <input type="checkbox" checked={openToGroupTravel} onChange={(e) => setOpenToGroupTravel(e.target.checked)} />
              Open to group travel
            </label>
            <label className="flex items-center gap-2 text-sm text-ink/80">
              <input type="checkbox" checked={openToCaptainLedTrips} onChange={(e) => setOpenToCaptainLedTrips(e.target.checked)} />
              Open to captain-led trips
            </label>
          </div>

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
                    <Badge key={lang}>
                      {lang}
                      <button type="button" onClick={() => removeLanguage(lang)} aria-label={`Remove ${lang}`} className="text-ink/50 hover:text-ink">
                        <X size={11} />
                      </button>
                    </Badge>
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
                    <Badge key={key}>
                      {key} &middot; {typeof value === 'number' ? value.toFixed(2) : String(value)}
                      <button type="button" onClick={() => removeInterest(key)} aria-label={`Remove ${key}`} className="text-ink/50 hover:text-ink">
                        <X size={11} />
                      </button>
                    </Badge>
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
