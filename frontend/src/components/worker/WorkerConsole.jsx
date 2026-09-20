import { useEffect, useState } from 'react'
import {
  Briefcase, MapPin, CalendarDays, Star, ShieldCheck,
  IndianRupee, Radio, ListChecks, UserRound, Plus, X,
} from 'lucide-react'
import { useWorkerStore } from '../../store/useWorkerStore'
import { workerSkillLabel, gigMatchStatus, WORKER_SKILL_LABEL } from '../../lib/labels'
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
  const { profile, isSavingProfile, saveProfileError, saveProfile, isSavingAvailability, availabilityError, updateAvailability } = useWorkerStore()
  const allDestinations = useDestinationGroups().flatMap((g) => g.destinations)
  const [skills, setSkills] = useState(profile?.skills || [])
  const [areas, setAreas] = useState(profile?.serviceAreaDestIds || [])
  const [languages, setLanguages] = useState((profile?.languages || []).join(', '))
  const [rateMin, setRateMin] = useState(profile?.rateExpectation?.min ?? '')
  const [rateMax, setRateMax] = useState(profile?.rateExpectation?.max ?? '')
  const [rateUnit, setRateUnit] = useState(profile?.rateExpectation?.unit || 'day')
  const [saved, setSaved] = useState(false)
  const [newWindowDate, setNewWindowDate] = useState('')

  const toggleSkill = (s) => setSkills((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
  const toggleArea = (id) => setAreas((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  async function handleSave(e) {
    e.preventDefault()
    setSaved(false)
    const ok = await saveProfile({
      skills,
      serviceAreaDestIds: areas,
      languages: languages.split(',').map((l) => l.trim()).filter(Boolean),
      rateExpectation: { min: Number(rateMin) || undefined, max: Number(rateMax) || undefined, unit: rateUnit },
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
          <h2 className="mb-4 text-sm font-semibold text-ink">Skills & service area</h2>
          <form onSubmit={handleSave} className="space-y-5">
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
  const { openGigs, isLoadingGigs, gigsError, fetchOpenGigs, isAccepting, acceptError, acceptGig, profile } = useWorkerStore()
  const [destId, setDestId] = useState(profile?.serviceAreaDestIds?.[0] || '')
  const [skill, setSkill] = useState('')

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
          <FormField label="Destination" optional><DestinationSelect value={destId} onChange={setDestId} /></FormField>
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
              <Button variant="primary" size="sm" fullWidth className="mt-3" loading={isAccepting === g._id} onClick={() => acceptGig(g._id)}>Accept this gig</Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function RateForm({ gigId, onSubmit, isSubmitting }) {
  const [score, setScore] = useState(5)
  const [comment, setComment] = useState('')
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(gigId, { score, comment }) }} className="mt-3 flex flex-wrap items-center gap-2 border-t border-paper-dim pt-3">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => setScore(n)} aria-label={`${n} stars`} className={n <= score ? 'text-pressure' : 'text-paper-dim'}>
            <Star size={18} fill="currentColor" />
          </button>
        ))}
      </div>
      <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="A short note (optional)" className={`${inputClass} flex-1`} />
      <Button type="submit" variant="outline" size="sm" loading={isSubmitting}>Rate</Button>
    </form>
  )
}

function MyJobsTab() {
  const { myGigs, isLoadingMyGigs, myGigsError, fetchMyGigs, isCompleting, completeError, completeGig, isRating, rateGig } = useWorkerStore()

  useEffect(() => {
    fetchMyGigs()
    const interval = setInterval(() => fetchMyGigs({ silent: true }), POLL_MS)
    return () => clearInterval(interval)
  }, [fetchMyGigs])

  if (isLoadingMyGigs) return <LoadingState label="Loading your jobs…" />
  if (myGigsError) return <Alert tone="error">{myGigsError}</Alert>
  if (myGigs.length === 0) return <EmptyState icon={ListChecks} title="No jobs yet" description="Gigs you're offered, accept, or complete will show up here." />

  return (
    <div className="space-y-3">
      {completeError && <Alert tone="error">{completeError}</Alert>}
      {myGigs.map(({ match, gig }) => {
        const state = gigMatchStatus(match.status)
        return (
          <Card key={match._id} padding="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-ink">{workerSkillLabel(gig.skillNeeded)} · {getDestinationLabel(gig.destId)}</p>
                <p className="text-xs text-ash">{dayLabel(gig.startDate)} – {dayLabel(gig.endDate)}</p>
              </div>
              <Badge tone={state.tone}>{state.label}</Badge>
            </div>
            {match.status === 'accepted' && (
              <Button variant="primary" size="sm" className="mt-3" loading={isCompleting === String(gig._id)} onClick={() => completeGig(gig._id)}>Mark complete</Button>
            )}
            {match.status === 'completed' && !match.ratingByWorker && (
              <RateForm gigId={gig._id} isSubmitting={isRating === String(gig._id)} onSubmit={rateGig} />
            )}
            {match.ratingByWorker && (
              <p className="mt-2 text-xs text-ash">You rated this operator {match.ratingByWorker.score} ★</p>
            )}
          </Card>
        )
      })}
    </div>
  )
}

const TABS = [
  { key: 'gigs', label: 'Gigs Near You', icon: Briefcase },
  { key: 'jobs', label: 'My Jobs', icon: ListChecks },
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
          {activeTab === 'jobs' && <MyJobsTab />}
          {activeTab === 'profile' && <ProfileTab />}
        </>
      )}
    </div>
  )
}
