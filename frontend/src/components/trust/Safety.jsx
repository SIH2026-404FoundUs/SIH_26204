import { useEffect, useState } from 'react'
import { Phone, Search, Share2, Copy, Check, X, ClipboardList, ShieldCheck } from 'lucide-react'
import { useTrustStore } from '../../store/useTrustStore'
import { useTripsStore } from '../../store/useTripsStore'
import { complaintCategoryLabel, COMPLAINT_CATEGORY_LABEL, complaintStatus } from '../../lib/labels'
import { getDestinationLabel } from '../../lib/destinations'
import PageHeader from '../ui/PageHeader'
import Card from '../ui/Card'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import Alert from '../ui/Alert'
import EmptyState from '../ui/EmptyState'
import LoadingState from '../ui/LoadingState'
import FormField, { inputClass } from '../ui/FormField'
import DestinationSelect from '../ui/DestinationSelect'

const CONTACT_LABELS = {
  police: 'Police', ambulance: 'Ambulance', disasterHelpline: 'Disaster helpline',
  controlRoom: 'Control room', touristPolice: 'Tourist police',
}

const TABS = [
  { key: 'emergency', label: 'Emergency', icon: Phone },
  { key: 'share', label: 'Share trip', icon: Share2 },
  { key: 'report', label: 'Report', icon: ClipboardList },
]

// One trip's real destId/dates -- same derivation useNotificationsStore
// already uses (redirectedToDestId wins if the trip was redirected;
// finalDates wins once a trip is actually confirmed).
function tripDestAndDates(trip) {
  const destId = trip.redirectedToDestId || trip.requestedDestId
  const dates = trip.finalDates?.startDate ? trip.finalDates : trip.requestedDates
  return { destId, dates }
}

function EmergencyTab() {
  const { emergencyContacts, fetchEmergencyContacts } = useTrustStore()
  const [destId, setDestId] = useState('manali')

  return (
    <Card>
      <div className="mb-4 flex items-center gap-2">
        <Phone size={17} className="text-pressure" aria-hidden="true" />
        <div>
          <h2 className="text-sm font-semibold text-ink">Emergency contacts</h2>
          <p className="text-xs text-ash">Local police, ambulance, and disaster helpline numbers for a destination.</p>
        </div>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); fetchEmergencyContacts(destId) }} className="mb-4 flex items-end gap-3">
        <div className="flex-1"><FormField label="Destination"><DestinationSelect value={destId} onChange={setDestId} /></FormField></div>
        <Button type="submit" variant="primary" icon={Search}>Look up</Button>
      </form>
      {emergencyContacts ? (
        <div className="grid grid-cols-2 gap-4 rounded-lg border border-paper-dim bg-paper-dim/20 p-4 text-sm sm:grid-cols-3">
          {Object.entries(CONTACT_LABELS).map(([key, label]) =>
            emergencyContacts[key] ? (
              <div key={key}>
                <p className="text-xs text-ash">{label}</p>
                <p className="font-medium text-ink">{emergencyContacts[key]}</p>
              </div>
            ) : null
          )}
        </div>
      ) : (
        <EmptyState icon={Phone} title="Look up a destination" description="Pick where you are (or heading to) and we'll show the real local contacts." />
      )}
    </Card>
  )
}

// Shareable Trip Record (spec §5) -- generates a real, revocable, PII-
// minimized read-only link for one of this traveller's own trips (e.g. to
// send to family before setting off). Only the most recently created link
// is shown: the backend has no "list my past shares" endpoint, so this
// doesn't fabricate a history it can't actually fetch -- create a new one
// any time, revoke the current one, that's the real surface available.
function ShareTripTab() {
  const { trips, fetchMyTrips } = useTripsStore()
  const { activeShare, isCreatingShare, shareError, createTripShare, revokeTripShare } = useTrustStore()
  const [tripId, setTripId] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => { fetchMyTrips() }, [fetchMyTrips])

  const shareUrl = activeShare ? `${window.location.origin}/trip/share/${activeShare.shareToken}` : null

  async function handleShare(e) {
    e.preventDefault()
    const trip = trips.find((t) => t._id === tripId)
    if (!trip) return
    const { destId, dates } = tripDestAndDates(trip)
    await createTripShare({
      tripId: trip._id,
      title: `Trip to ${getDestinationLabel(destId)}`,
      destId,
      startDate: dates?.startDate,
      endDate: dates?.endDate,
      stops: trip.stops,
    })
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard permission denied -- the link is still visible to select manually
    }
  }

  return (
    <Card>
      <div className="mb-4 flex items-center gap-2">
        <Share2 size={17} className="text-relief" aria-hidden="true" />
        <div>
          <h2 className="text-sm font-semibold text-ink">Share your trip</h2>
          <p className="text-xs text-ash">A read-only link -- no contact details or payment info -- so someone back home can see your itinerary.</p>
        </div>
      </div>

      {trips.length === 0 ? (
        <EmptyState icon={Share2} title="No trips yet" description="Plan a trip first, then come back here to share it." />
      ) : (
        <form onSubmit={handleShare} className="flex items-end gap-3">
          <div className="flex-1">
            <FormField label="Which trip?">
              <select value={tripId} onChange={(e) => setTripId(e.target.value)} required className={inputClass}>
                <option value="" disabled>Choose a trip</option>
                {trips.map((t) => {
                  const { destId, dates } = tripDestAndDates(t)
                  return <option key={t._id} value={t._id}>{getDestinationLabel(destId)}{dates?.startDate ? ` · ${dates.startDate}` : ''}</option>
                })}
              </select>
            </FormField>
          </div>
          <Button type="submit" variant="primary" loading={isCreatingShare} disabled={!tripId}>Create link</Button>
        </form>
      )}

      {shareError && <div className="mt-3"><Alert tone="error">{shareError}</Alert></div>}

      {activeShare && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-paper-dim bg-paper-dim/30 px-3 py-2.5">
          <span className="flex-1 truncate font-mono text-xs text-ink/80">{shareUrl}</span>
          <Button type="button" variant="secondary" size="sm" icon={copied ? Check : Copy} onClick={copyLink}>{copied ? 'Copied' : 'Copy'}</Button>
          <Button type="button" variant="outline" size="sm" icon={X} onClick={revokeTripShare}>Revoke</Button>
        </div>
      )}
      {activeShare && <p className="mt-2 text-xs text-ash">Expires {new Date(activeShare.expiresAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}, or sooner if you revoke it.</p>}
    </Card>
  )
}

// "Your complaints" -- real status progression (logged/under_review/
// resolved), no auto-resolution. Kept on the same tab as the submit form
// since seeing where your last report stands is the natural next thing to
// check right after filing one.
function ReportTab() {
  const {
    submitComplaint, isSubmittingComplaint, complaintResult, safetyError,
    myComplaints, isLoadingComplaints, fetchMyComplaints,
  } = useTrustStore()
  const [complaint, setComplaint] = useState({ destId: 'manali', category: 'other', text: '' })

  useEffect(() => { fetchMyComplaints() }, [fetchMyComplaints])

  async function handleComplaint(e) {
    e.preventDefault()
    const ok = await submitComplaint(complaint)
    if (ok) setComplaint((p) => ({ ...p, text: '' }))
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <ClipboardList size={17} className="text-pressure" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-semibold text-ink">Report a problem</h2>
            <p className="text-xs text-ash">Overcharging, safety concerns, or anything else that needs flagging. Logged for platform review -- not sent to any government authority.</p>
          </div>
        </div>
        <form onSubmit={handleComplaint} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Destination"><DestinationSelect value={complaint.destId} onChange={(v) => setComplaint((p) => ({ ...p, destId: v }))} /></FormField>
            <FormField label="Category">
              <select value={complaint.category} onChange={(e) => setComplaint((p) => ({ ...p, category: e.target.value }))} className={inputClass}>
                {Object.keys(COMPLAINT_CATEGORY_LABEL).map((c) => <option key={c} value={c}>{complaintCategoryLabel(c)}</option>)}
              </select>
            </FormField>
          </div>
          <FormField label="What happened?">
            <textarea required rows={3} value={complaint.text} onChange={(e) => setComplaint((p) => ({ ...p, text: e.target.value }))} className={inputClass} />
          </FormField>
          <Button type="submit" variant="primary" fullWidth loading={isSubmittingComplaint}>Submit</Button>
        </form>
        {safetyError && <div className="mt-4"><Alert tone="error">{safetyError}</Alert></div>}
        {complaintResult?.success && <div className="mt-4"><Alert tone="success">Report submitted. {complaintResult.disclaimer}</Alert></div>}
      </Card>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Your complaints</h2>
          {myComplaints.length > 0 && <Badge tone="neutral">{myComplaints.length}</Badge>}
        </div>
        {isLoadingComplaints ? (
          <LoadingState label="Loading your complaints…" />
        ) : myComplaints.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Nothing reported yet" description="Reports you submit above will show up here so you can track their status." />
        ) : (
          <div className="space-y-2">
            {myComplaints.map((c) => {
              const status = complaintStatus(c.status)
              return (
                <Card key={c._id} padding="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-ink">{complaintCategoryLabel(c.category)} · {getDestinationLabel(c.destId)}</p>
                      <p className="mt-1 text-xs text-ink/60">{c.text}</p>
                    </div>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>
                  <p className="mt-2 text-[11px] text-ash">{new Date(c.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}</p>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default function Safety() {
  const [tab, setTab] = useState('emergency')

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader icon={ShieldCheck} title="Safety" description="Emergency contacts, sharing your itinerary, and flagging anything that needs attention -- all in one place." />

      <div className="mb-6 flex items-center gap-1.5 rounded-lg bg-paper-dim/50 p-1">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-sm font-semibold transition ${tab === key ? 'bg-white text-ink shadow-sm' : 'text-ink/60'}`}
          >
            <Icon size={15} aria-hidden="true" /> {label}
          </button>
        ))}
      </div>

      {tab === 'emergency' && <EmergencyTab />}
      {tab === 'share' && <ShareTripTab />}
      {tab === 'report' && <ReportTab />}
    </div>
  )
}
