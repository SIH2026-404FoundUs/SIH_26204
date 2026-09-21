import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Users, Search, Plus, ListChecks, CalendarDays, IndianRupee } from 'lucide-react'
import { useGroupTravelStore } from '../../store/useGroupTravelStore'
import { useTravelTypesTaxonomy, activityLabel, paceLabel } from '../../lib/travelTypes'
import { getDestinationLabel } from '../../lib/destinations'
import { groupTripStatus } from '../../lib/labels'
import PageHeader from '../ui/PageHeader'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Alert from '../ui/Alert'
import LoadingState from '../ui/LoadingState'
import EmptyState from '../ui/EmptyState'
import FormField, { inputClass } from '../ui/FormField'
import DestinationSelect from '../ui/DestinationSelect'

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

function DiscoverTab() {
  const { matches, isLoadingMatches, matchesError, searchMatches } = useGroupTravelStore()
  const [destId, setDestId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [searched, setSearched] = useState(false)

  function handleSearch(e) {
    e.preventDefault()
    if (!destId) return
    setSearched(true)
    searchMatches({ destId, startDate: startDate || undefined, endDate: endDate || undefined })
  }

  return (
    <div>
      <Card className="mb-4">
        <form onSubmit={handleSearch} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <FormField label="Destination"><DestinationSelect value={destId} onChange={setDestId} /></FormField>
          <FormField label="From" optional><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} /></FormField>
          <FormField label="To" optional><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} /></FormField>
          <div className="flex items-end"><Button type="submit" icon={Search} loading={isLoadingMatches} fullWidth disabled={!destId}>Find groups</Button></div>
        </form>
      </Card>

      {matchesError && <div className="mb-4"><Alert tone="error">{matchesError}</Alert></div>}

      {isLoadingMatches ? (
        <LoadingState label="Finding compatible groups…" />
      ) : !searched ? (
        <EmptyState icon={Search} title="Pick a destination" description="Choose where you want to go to see compatible open groups, matched against your saved travel preferences." />
      ) : matches.length === 0 ? (
        <EmptyState icon={Users} title="No matching groups yet" description="No open groups fit this destination/dates right now -- be the first to create one." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {matches.map(({ groupTrip, reasons }) => {
            const status = groupTripStatus(groupTrip.status)
            return (
              <Card key={groupTrip._id} padding="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">{getDestinationLabel(groupTrip.destId)}</p>
                    <p className="flex items-center gap-1 text-xs text-ash"><CalendarDays size={12} aria-hidden="true" /> {new Date(groupTrip.startDate).toLocaleDateString(undefined, { dateStyle: 'medium' })} – {new Date(groupTrip.endDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}</p>
                  </div>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </div>
                <p className="mt-2 text-xs text-ink/70">{groupTrip.currentMembers}/{groupTrip.maxMembers} travellers</p>
                {reasons?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {reasons.map((r) => <Badge key={r} tone="info">{r}</Badge>)}
                  </div>
                )}
                <Link to={`/travel-together/groups/${groupTrip._id}`}>
                  <Button variant="primary" size="sm" fullWidth className="mt-3">View group</Button>
                </Link>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CreateTab() {
  const navigate = useNavigate()
  const { isCreating, createError, createGroupTrip } = useGroupTravelStore()
  const taxonomy = useTravelTypesTaxonomy()
  const [destId, setDestId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [maxMembers, setMaxMembers] = useState('4')
  const [joinPolicy, setJoinPolicy] = useState('request')
  const [travelTypes, setTravelTypes] = useState([])
  const [activities, setActivities] = useState([])
  const [pace, setPace] = useState('')
  const [budgetMin, setBudgetMin] = useState('')
  const [budgetMax, setBudgetMax] = useState('')

  const toggleType = (id) => setTravelTypes((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]))
  const toggleActivity = (id) => setActivities((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]))

  async function handleSubmit(e) {
    e.preventDefault()
    const group = await createGroupTrip({
      destId, startDate, endDate, maxMembers: Number(maxMembers), joinPolicy,
      travelTypes, activities, pace: pace || undefined,
      budgetRange: budgetMin || budgetMax ? { min: budgetMin ? Number(budgetMin) : undefined, max: budgetMax ? Number(budgetMax) : undefined } : undefined,
    })
    if (group) navigate(`/travel-together/groups/${group._id}`)
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FormField label="Destination"><DestinationSelect value={destId} onChange={setDestId} /></FormField>
          <FormField label="Start date"><input required type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} /></FormField>
          <FormField label="End date"><input required type="date" min={startDate || undefined} value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} /></FormField>
        </div>

        <FormField label="Travel style" optional>
          <div className="flex flex-wrap gap-2">
            {taxonomy.travelTypes.map((t) => <ChipToggle key={t.id} active={travelTypes.includes(t.id)} onClick={() => toggleType(t.id)}>{t.label}</ChipToggle>)}
          </div>
        </FormField>

        <FormField label="Activities" optional>
          <div className="flex flex-wrap gap-2">
            {taxonomy.preferredActivities.map((a) => <ChipToggle key={a} active={activities.includes(a)} onClick={() => toggleActivity(a)}>{activityLabel(a)}</ChipToggle>)}
          </div>
        </FormField>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <FormField label="Pace" optional>
            <select value={pace} onChange={(e) => setPace(e.target.value)} className={inputClass}>
              <option value="">Not set</option>
              {taxonomy.preferredPace.map((p) => <option key={p} value={p}>{paceLabel(p)}</option>)}
            </select>
          </FormField>
          <FormField label="Max members"><input required type="number" min="2" value={maxMembers} onChange={(e) => setMaxMembers(e.target.value)} className={inputClass} /></FormField>
          <FormField label="Budget min (INR)" optional><input type="number" min="0" value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} className={inputClass} /></FormField>
          <FormField label="Budget max (INR)" optional><input type="number" min="0" value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} className={inputClass} /></FormField>
        </div>

        <FormField label="Who can join" hint="Open: anyone joins instantly. Request: you approve each join.">
          <select value={joinPolicy} onChange={(e) => setJoinPolicy(e.target.value)} className={inputClass}>
            <option value="request">Request to join</option>
            <option value="open">Open -- join instantly</option>
          </select>
        </FormField>

        {createError && <Alert tone="error">{createError}</Alert>}

        <Button type="submit" variant="primary" icon={Plus} loading={isCreating} disabled={!destId || !startDate || !endDate}>Create group</Button>
      </form>
    </Card>
  )
}

function MyGroupsTab() {
  const { myGroupTrips, isLoadingMyGroupTrips, myGroupTripsError, fetchMyGroupTrips } = useGroupTravelStore()
  useEffect(() => { fetchMyGroupTrips() }, [fetchMyGroupTrips])

  if (isLoadingMyGroupTrips) return <LoadingState label="Loading your groups…" />
  if (myGroupTripsError) return <Alert tone="error">{myGroupTripsError}</Alert>
  if (myGroupTrips.length === 0) return <EmptyState icon={ListChecks} title="No groups yet" description="Groups you create or join will show up here." />

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {myGroupTrips.map((g) => {
        const status = groupTripStatus(g.status)
        const memberStatus = g.myMembership?.status
        return (
          <Card key={g._id} padding="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-ink">{getDestinationLabel(g.destId)}</p>
                <p className="flex items-center gap-1 text-xs text-ash"><CalendarDays size={12} aria-hidden="true" /> {new Date(g.startDate).toLocaleDateString(undefined, { dateStyle: 'medium' })} – {new Date(g.endDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}</p>
              </div>
              <Badge tone={status.tone}>{status.label}</Badge>
            </div>
            <p className="mt-2 text-xs text-ink/70">{g.currentMembers}/{g.maxMembers} travellers{memberStatus === 'requested' ? ' · your request is pending' : ''}</p>
            {g.budgetRange?.min != null && <p className="mt-1 flex items-center gap-1 text-xs text-ink/70"><IndianRupee size={12} aria-hidden="true" /> {g.budgetRange.min}–{g.budgetRange.max ?? '?'}</p>}
            <Link to={`/travel-together/groups/${g._id}`}>
              <Button variant="outline" size="sm" fullWidth className="mt-3">Open</Button>
            </Link>
          </Card>
        )
      })}
    </div>
  )
}

const TABS = [
  { key: 'discover', label: 'Discover', icon: Search },
  { key: 'create', label: 'Create', icon: Plus },
  { key: 'mine', label: 'My Groups', icon: ListChecks },
]

// Travel Together (Revised Implementation Plan §16's suggested nav):
// Discover / Create / My Groups, the traveller-facing home for Group Travel.
export default function TravelTogether() {
  const [activeTab, setActiveTab] = useState('discover')

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader icon={Users} title="Travel Together" description="Find compatible travellers, form a squad, and travel with company -- matched on your own saved preferences." />

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

      {activeTab === 'discover' && <DiscoverTab />}
      {activeTab === 'create' && <CreateTab />}
      {activeTab === 'mine' && <MyGroupsTab />}
    </div>
  )
}
