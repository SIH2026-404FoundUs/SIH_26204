import { useEffect, useState } from 'react'
import {
  Briefcase, MapPin, CalendarDays, Star, ShieldCheck,
  IndianRupee, Radio, UserRound, Plus, X, Award, IdCard,
} from 'lucide-react'
import { useWorkerStore } from '../../store/useWorkerStore'
import { workerSkillLabel, WORKER_SKILL_LABEL, GOVERNMENT_ID_TYPE_LABEL, getWorkerBadges } from '../../lib/labels'
import { getDestinationLabel, useDestinationGroups } from '../../lib/destinations'
import PageHeader from '../ui/PageHeader'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Alert from '../ui/Alert'
import LoadingState from '../ui/LoadingState'
import EmptyState from '../ui/EmptyState'
import FormField, { inputClass } from '../ui/FormField'
import DestinationSelect from '../ui/DestinationSelect'

const POLL_MS = 15_000 // same live-data cadence every other role's home screen uses
const SKILLS = Object.keys(WORKER_SKILL_LABEL)
const today = () => new Date().toISOString().slice(0, 10)
const dayLabel = (v) => (v ? new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

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

// Onboarding + Profile, one form -- worker-role-spec.md §06 lists these as
// two screens, but the fields are identical (skills, service area,
// languages, rate, availability); POST /v1/workers is create-or-update
// either way, so this is one component used for both "first time setup"
// and "edit later", same as OperatorConsole's own availability form serves
// both cases.
function ProfileTab() {
  const { profile, isSavingProfile, saveProfileError, saveProfile, isSavingAvailability, availabilityError, updateAvailability, myGigs, fetchMyGigs } = useWorkerStore()
  const allDestinations = useDestinationGroups().flatMap((g) => g.destinations)
  const [skills, setSkills] = useState(profile?.skills || [])
  const [areas, setAreas] = useState(profile?.serviceAreaDestIds || [])
  const [languages, setLanguages] = useState((profile?.languages || []).join(', '))
  const [rateMin, setRateMin] = useState(profile?.rateExpectation?.min ?? '')
  const [rateMax, setRateMax] = useState(profile?.rateExpectation?.max ?? '')
  const [rateUnit, setRateUnit] = useState(profile?.rateExpectation?.unit || 'day')
  const [legalName, setLegalName] = useState(profile?.legalName || '')
  const [idType, setIdType] = useState(profile?.governmentId?.idType || 'aadhaar')
  const [idNumber, setIdNumber] = useState(profile?.governmentId?.idNumber || '')
  const [saved, setSaved] = useState(false)
  const [newWindowDate, setNewWindowDate] = useState('')

  const toggleSkill = (s) => setSkills((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
  const toggleArea = (id) => setAreas((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  const completedCount = myGigs.filter((row) => row.match.status === 'completed').length
  const badges = getWorkerBadges(profile, completedCount)

  useEffect(() => { fetchMyGigs({ silent: true }) }, [fetchMyGigs])

  async function handleSave(e) {
    e.preventDefault()
    setSaved(false)
    const ok = await saveProfile({
      skills,
      serviceAreaDestIds: areas,
      languages: languages.split(',').map((l) => l.trim()).filter(Boolean),
      rateExpectation: { min: Number(rateMin) || undefined, max: Number(rateMax) || undefined, unit: rateUnit },
      legalName,
      governmentId: idNumber.trim() ? { idType, idNumber: idNumber.trim() } : undefined,
    })
    if (ok) setSaved(true)
  }

  async function setModeNow() {
    await updateAvailability({ mode: 'now' })
  }
  async function setModeScheduled() {
    await updateAvailability({ mode: 'scheduled' })
  }
  async function addWindow(e) {
    e.preventDefault()
    if (!newWindowDate) return
    const windows = [...(profile?.availability?.windows || []), { date: newWindowDate }]
    await updateAvailability({ windows })
    setNewWindowDate('')
  }
  async function removeWindow(date) {
    const windows = (profile?.availability?.windows || []).filter((w) => w.date !== date && new Date(w.date).toISOString().slice(0, 10) !== date)
    await updateAvailability({ windows })
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
      <div>
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-ink">Your details</h2>
          <form onSubmit={handleSave} className="space-y-5">
            <FormField label="Legal name" hint="So an operator knows who they're actually hiring">
              <input required value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="As on your ID" className={inputClass} />
            </FormField>

            <FormField label="Government ID" hint="Self-declared, not verified -- stored for the operator's reference only">
              <div className="grid grid-cols-2 gap-2">
                <select required value={idType} onChange={(e) => setIdType(e.target.value)} className={inputClass}>
                  {Object.entries(GOVERNMENT_ID_TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <input required value={idNumber} onChange={(e) => setIdNumber(e.target.value)} placeholder="ID number" className={inputClass} />
              </div>
            </FormField>

            <FormField label="Skills"><div className="flex flex-wrap gap-2">{SKILLS.map((s) => <ChipToggle key={s} active={skills.includes(s)} onClick={() => toggleSkill(s)}>{workerSkillLabel(s)}</ChipToggle>)}</div></FormField>

            <FormField label="Service area" hint="Destinations you can realistically reach for a gig">
              <div className="max-h-48 overflow-y-auto rounded-lg border border-paper-dim p-3">
                <div className="flex flex-wrap gap-2">
                  {allDestinations.map((d) => <ChipToggle key={d.id} active={areas.includes(d.id)} onClick={() => toggleArea(d.id)}>{d.label}</ChipToggle>)}
                </div>
              </div>
            </FormField>

            <FormField label="Languages" optional hint="Comma-separated"><input value={languages} onChange={(e) => setLanguages(e.target.value)} placeholder="Hindi, English" className={inputClass} /></FormField>

            <FormField label="Rate expectation" optional>
              <div className="grid grid-cols-3 gap-2">
                <input type="number" min="0" value={rateMin} onChange={(e) => setRateMin(e.target.value)} placeholder="Min ₹" className={inputClass} />
                <input type="number" min="0" value={rateMax} onChange={(e) => setRateMax(e.target.value)} placeholder="Max ₹" className={inputClass} />
                <select value={rateUnit} onChange={(e) => setRateUnit(e.target.value)} className={inputClass}>
                  <option value="day">per day</option>
                  <option value="trip">per trip</option>
                  <option value="hour">per hour</option>
                </select>
              </div>
            </FormField>

            {saveProfileError && <Alert tone="error">{saveProfileError}</Alert>}
            {saved && <Alert tone="success">Profile saved.</Alert>}

            <Button type="submit" variant="primary" loading={isSavingProfile}>{profile ? 'Save changes' : 'Create profile'}</Button>
          </form>
        </Card>

        {profile && (
          <Card className="mt-6">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink"><Radio size={16} className="text-relief" aria-hidden="true" /> Availability</h2>
            <div className="mb-4 flex gap-2">
              <Button type="button" variant={profile.availability?.mode === 'now' ? 'primary' : 'outline'} size="sm" loading={isSavingAvailability} onClick={setModeNow}>Free right now</Button>
              <Button type="button" variant={profile.availability?.mode === 'scheduled' ? 'primary' : 'outline'} size="sm" loading={isSavingAvailability} onClick={setModeScheduled}>Scheduled windows</Button>
            </div>
            {availabilityError && <div className="mb-3"><Alert tone="error">{availabilityError}</Alert></div>}
            {profile.availability?.mode === 'scheduled' && (
              <>
                <form onSubmit={addWindow} className="mb-3 flex gap-2">
                  <input type="date" min={today()} value={newWindowDate} onChange={(e) => setNewWindowDate(e.target.value)} className={inputClass} />
                  <Button type="submit" variant="outline" icon={Plus}>Add</Button>
                </form>
                {(profile.availability?.windows || []).length === 0 ? (
                  <p className="text-xs text-ash">No dates added yet -- gigs on unlisted dates won't match you.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {profile.availability.windows.map((w) => {
                      const iso = new Date(w.date).toISOString().slice(0, 10)
                      return (
                        <span key={iso} className="inline-flex items-center gap-1.5 rounded-full bg-paper-dim px-3 py-1 text-xs font-medium text-ink/70">
                          {dayLabel(w.date)}
                          <button type="button" onClick={() => removeWindow(iso)} aria-label={`Remove ${iso}`} className="text-ink/40 hover:text-pressure"><X size={11} /></button>
                        </span>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </Card>
        )}
      </div>

      {profile && (
        <aside className="space-y-4">
          <Card padding="p-4">
            <div className="mb-3 flex items-center gap-2"><Award size={16} className="text-pressure" aria-hidden="true" /><h2 className="text-sm font-semibold text-ink">Badges</h2></div>
            {badges.length === 0 ? (
              <p className="text-xs text-ash">No badges yet -- these are earned automatically from your profile and job history.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {badges.map((b) => <Badge key={b.key} tone={b.tone}>{b.label}</Badge>)}
              </div>
            )}
          </Card>
          {profile.legalName && (
            <Card padding="p-4">
              <div className="mb-2 flex items-center gap-2"><IdCard size={16} className="text-ink/60" aria-hidden="true" /><h2 className="text-sm font-semibold text-ink">Registered as</h2></div>
              <p className="text-sm text-ink">{profile.legalName}</p>
              {profile.governmentId?.idNumber && (
                <p className="mt-0.5 text-xs text-ash">{GOVERNMENT_ID_TYPE_LABEL[profile.governmentId.idType]} on file</p>
              )}
            </Card>
          )}
          <Card padding="p-4">
            <div className="mb-3 flex items-center gap-2"><Star size={16} className="text-pressure" aria-hidden="true" /><h2 className="text-sm font-semibold text-ink">Rating</h2></div>
            {profile.rating?.count > 0 ? (
              <>
                <span className="font-display text-2xl text-ink">{profile.rating.avg.toFixed(1)} ★</span>
                <p className="text-[11px] text-ash">across {profile.rating.count} completed gig{profile.rating.count === 1 ? '' : 's'}</p>
              </>
            ) : (
              <p className="text-xs text-ash">No ratings yet -- these come from operators after a completed gig.</p>
            )}
          </Card>
          <Card padding="p-4">
            <div className="mb-3 flex items-center gap-2"><ShieldCheck size={16} className="text-relief" aria-hidden="true" /><h2 className="text-sm font-semibold text-ink">Verification</h2></div>
            <Badge tone={profile.verificationTier === 'registered' ? 'success' : profile.verificationTier === 'visit-verified' ? 'info' : 'neutral'}>{profile.verificationTier}</Badge>
          </Card>
        </aside>
      )}
    </div>
  )
}

function GigsNearYouTab() {
  const { openGigs, isLoadingGigs, gigsError, fetchOpenGigs, isAccepting, acceptError, acceptGig } = useWorkerStore()
  // Defaults to every destination, not just this worker's own first service
  // area -- a real bug this used to be: an operator's gig for a destination
  // that wasn't the worker's *first-listed* one was silently invisible on
  // load, with no way to clear the filter back to "all" (DestinationSelect's
  // blank option used to be permanently disabled). See allowAll below.
  const [destId, setDestId] = useState('')
  const [skill, setSkill] = useState('')
  const [queuedGigId, setQueuedGigId] = useState(null)

  async function handleAccept(gigId) {
    const result = await acceptGig(gigId)
    setQueuedGigId(result.queued ? gigId : null)
  }

  useEffect(() => {
    fetchOpenGigs({ destId, skill })
    const interval = setInterval(() => fetchOpenGigs({ destId, skill, silent: true }), POLL_MS)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destId, skill])

  return (
    <div>
      <Card className="mb-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="Destination" optional><DestinationSelect value={destId} onChange={setDestId} allowAll allLabel="All destinations" /></FormField>
          <FormField label="Skill" optional>
            <select value={skill} onChange={(e) => setSkill(e.target.value)} className={inputClass}>
              <option value="">Any skill</option>
              {SKILLS.map((s) => <option key={s} value={s}>{workerSkillLabel(s)}</option>)}
            </select>
          </FormField>
        </div>
      </Card>

      {gigsError && <div className="mb-4"><Alert tone="error">{gigsError}</Alert></div>}
      {acceptError && <div className="mb-4"><Alert tone="error">{acceptError}</Alert></div>}
      {queuedGigId && <div className="mb-4"><Alert tone="warning">No connection right now -- your accept is saved on this device and will be sent the moment you're back online. It isn't confirmed until then.</Alert></div>}

      {isLoadingGigs ? (
        <LoadingState label="Looking for nearby gigs…" />
      ) : openGigs.length === 0 ? (
        <EmptyState icon={Briefcase} title="No open gigs right now" description="Nothing matches this filter yet -- check back soon, or widen your service area in Profile." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {openGigs.map((g) => (
            <Card key={g._id} padding="p-4" className="border-l-4 border-l-relief">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-ink">{workerSkillLabel(g.skillNeeded)}</p>
                  <p className="flex items-center gap-1 text-xs text-ash"><MapPin size={12} aria-hidden="true" /> {getDestinationLabel(g.destId)}</p>
                </div>
                <Badge tone="info">{g.headcount} needed</Badge>
              </div>
              <p className="mt-2 flex items-center gap-1 text-xs text-ink/70"><CalendarDays size={12} aria-hidden="true" /> {dayLabel(g.startDate)} – {dayLabel(g.endDate)}</p>
              {(g.budget?.min != null || g.budget?.max != null) && (
                <p className="mt-1 flex items-center gap-1 text-xs text-ink/70"><IndianRupee size={12} aria-hidden="true" /> {g.budget.min ?? '?'}–{g.budget.max ?? '?'}</p>
              )}
              {g.notes && <p className="mt-2 text-xs text-ash">{g.notes}</p>}
              <Button variant="primary" size="sm" fullWidth className="mt-3" loading={isAccepting === g._id} onClick={() => handleAccept(g._id)}>Accept this gig</Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

const TABS = [
  { key: 'gigs', label: 'Gigs Near You', icon: Briefcase },
  { key: 'profile', label: 'Profile', icon: UserRound },
]

// Worker role's one primary screen (worker-role-spec.md §01: "no dashboard
// full of KPIs -- just: be found, get offered work, do it, get rated"),
// gated on having a profile at all (same "register a business first"
// empty-state pattern OperatorConsole/HirePeople already use for their own
// onboarding gates).
export default function WorkerConsole() {
  const { profile, hasCheckedProfile, isLoadingProfile, profileError, fetchMyProfile } = useWorkerStore()
  const [activeTab, setActiveTab] = useState('gigs')

  useEffect(() => { fetchMyProfile() }, [fetchMyProfile])

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader icon={Briefcase} title="Worker console" description="Get matched to nearby gigs, accept the ones that work for you, and get rated for completed jobs." />

      {profileError && <div className="mb-4"><Alert tone="error">{profileError}</Alert></div>}

      {!hasCheckedProfile && isLoadingProfile ? (
        <LoadingState label="Loading your profile…" />
      ) : !profile ? (
        <>
          <div className="mb-6"><Alert tone="info">Set up your worker profile first -- skills and service area are how gigs actually find you.</Alert></div>
          <ProfileTab />
        </>
      ) : (
        <>
          <div className="mb-6 flex flex-wrap gap-1.5 rounded-lg border border-paper-dim bg-white p-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition ${
                  activeTab === tab.key ? 'bg-ink text-paper shadow-sm' : 'text-ink/70 hover:bg-ink/5'
                }`}
              >
                <tab.icon size={15} aria-hidden="true" />
                {tab.label}
              </button>
            ))}
          </div>
          {activeTab === 'gigs' && <GigsNearYouTab />}
          {activeTab === 'profile' && <ProfileTab />}
        </>
      )}
    </div>
  )
}
