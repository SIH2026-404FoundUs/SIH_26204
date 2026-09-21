import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Users, IndianRupee, Check, X, UserPlus, ShieldCheck, BadgeCheck, Compass, Star } from 'lucide-react'
import { useGroupMembershipStore } from '../../store/useGroupMembershipStore'
import { useAuthStore } from '../../store/useAuthStore'
import { getDestinationLabel } from '../../lib/destinations'
import { groupTripStatus, groupMemberStatus } from '../../lib/labels'
import PageHeader from '../ui/PageHeader'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Alert from '../ui/Alert'
import LoadingState from '../ui/LoadingState'
import { inputClass } from '../ui/FormField'

function MemberRow({ member, isCreatorView, isActing, onAccept, onReject }) {
  const status = groupMemberStatus(member.status)
  const user = member.userId // populated {_id, fullName, profilePhoto}
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-paper-dim px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-xs font-semibold text-paper">
          {(user?.fullName || '?').charAt(0).toUpperCase()}
        </span>
        <div>
          <p className="text-sm font-medium text-ink">{user?.fullName || 'Traveller'}{member.role === 'creator' ? ' · Creator' : ''}</p>
          {member.matchReasons?.length > 0 && <p className="text-[11px] text-ash">{member.matchReasons.join(', ')}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge tone={status.tone}>{status.label}</Badge>
        {isCreatorView && member.status === 'requested' && (
          <>
            <Button variant="outline" size="sm" icon={Check} loading={isActing} onClick={onAccept}>Accept</Button>
            <Button variant="ghost" size="sm" icon={X} loading={isActing} onClick={onReject}>Reject</Button>
          </>
        )}
      </div>
    </div>
  )
}

// The Travel Squad view (Revised Implementation Plan §13): destination/
// dates, members + roles, captain, shared itinerary, announcements, and
// entry points into the EXISTING Safety and Proof-of-Visit surfaces --
// nothing rebuilt, just linked to from here.
export default function GroupTripDetail() {
  const { id } = useParams()
  const authUser = useAuthStore((s) => s.authUser)
  const {
    groupTrip, members, matchReasons, isLoading, error,
    isJoining, joinError, isLeaving, isActingOnMember, memberActionError,
    isUpdating, updateError, isRequestingCaptain, captainError,
    fetchGroupTrip, joinGroupTrip, leaveGroupTrip, acceptMember, rejectMember, updateGroupTrip, requestCaptain,
  } = useGroupMembershipStore()

  const [announcementText, setAnnouncementText] = useState('')

  useEffect(() => { fetchGroupTrip(id) }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <LoadingState label="Loading squad…" />
  if (error) return <Alert tone="error">{error}</Alert>
  if (!groupTrip) return null

  const isCreator = String(groupTrip.creatorId) === String(authUser?._id)
  const myMembership = members.find((m) => String(m.userId?._id || m.userId) === String(authUser?._id))
  const isActiveMember = myMembership?.status === 'accepted'
  const status = groupTripStatus(groupTrip.status)

  async function postAnnouncement(e) {
    e.preventDefault()
    if (!announcementText.trim()) return
    const nextAnnouncements = [...(groupTrip.announcements || []), { text: announcementText.trim() }]
    const ok = await updateGroupTrip(id, { announcements: nextAnnouncements })
    if (ok) setAnnouncementText('')
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/travel-together" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-ink">
        <ArrowLeft size={14} aria-hidden="true" /> Back to Travel Together
      </Link>

      <PageHeader icon={Users} title={getDestinationLabel(groupTrip.destId)} description={`${new Date(groupTrip.startDate).toLocaleDateString(undefined, { dateStyle: 'medium' })} – ${new Date(groupTrip.endDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}`} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={status.tone}>{status.label}</Badge>
        <Badge tone="neutral">{groupTrip.currentMembers}/{groupTrip.maxMembers} travellers</Badge>
        {groupTrip.pace && <Badge tone="info">{groupTrip.pace.replace('_', ' ')}</Badge>}
        {groupTrip.budgetRange?.min != null && <Badge tone="neutral"><IndianRupee size={11} className="mr-0.5 inline" />{groupTrip.budgetRange.min}–{groupTrip.budgetRange.max ?? '?'}</Badge>}
      </div>

      {groupTrip.pressureSnapshot?.score != null && (
        <Card className="mb-4" padding="p-3">
          <p className="text-xs text-ash">
            Crowding at creation: {Math.round(groupTrip.pressureSnapshot.score * 100)}/100
            {groupTrip.pressureSnapshot.confidence !== 'normal' ? ` (${groupTrip.pressureSnapshot.confidence})` : ''}.
            {' '}<Link to={`/explore/${groupTrip.destId}`} className="text-relief hover:underline">See current pressure & alternatives</Link>
          </p>
        </Card>
      )}

      {matchReasons?.reasons?.length > 0 && !isCreator && (
        <Card className="mb-4" padding="p-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ash">Why this group fits you</p>
          <div className="flex flex-wrap gap-1.5">{matchReasons.reasons.map((r) => <Badge key={r} tone="info">{r}</Badge>)}</div>
        </Card>
      )}

      {!isCreator && !myMembership && groupTrip.status === 'open' && (
        <Card className="mb-4">
          {joinError && <div className="mb-3"><Alert tone="error">{joinError}</Alert></div>}
          <Button variant="primary" icon={UserPlus} loading={isJoining} onClick={() => joinGroupTrip(id)} fullWidth>
            {groupTrip.joinPolicy === 'open' ? 'Join this group' : 'Request to join'}
          </Button>
        </Card>
      )}
      {isActiveMember && !isCreator && (
        <Card className="mb-4">
          <Button variant="outline" loading={isLeaving} onClick={() => leaveGroupTrip(id)} fullWidth>Leave group</Button>
        </Card>
      )}

      <Card className="mb-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Members</h2>
          <Badge tone="neutral">{members.length}</Badge>
        </div>
        {memberActionError && <div className="mb-3"><Alert tone="error">{memberActionError}</Alert></div>}
        <div className="space-y-2">
          {members.map((m) => (
            <MemberRow
              key={m._id}
              member={m}
              isCreatorView={isCreator}
              isActing={isActingOnMember === (m.userId?._id || m.userId)}
              onAccept={() => acceptMember(id, m.userId?._id || m.userId)}
              onReject={() => rejectMember(id, m.userId?._id || m.userId)}
            />
          ))}
        </div>
      </Card>

      <Card className="mb-4">
        <div className="mb-3 flex items-center gap-2">
          <Star size={16} className="text-relief" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-ink">Captain / guide</h2>
        </div>
        {groupTrip.captainId ? (
          <Badge tone="success">Captain assigned</Badge>
        ) : isCreator ? (
          <>
            {captainError && <div className="mb-3"><Alert tone="error">{captainError}</Alert></div>}
            <p className="mb-3 text-xs text-ash">Request a verified local guide through the existing Worker/Gig marketplace -- the first worker to accept becomes your captain.</p>
            <Button variant="outline" size="sm" loading={isRequestingCaptain} onClick={() => requestCaptain(id, { skillNeeded: 'guide' })}>Request a captain</Button>
          </>
        ) : (
          <p className="text-xs text-ash">No captain assigned yet.</p>
        )}
      </Card>

      <Card className="mb-4">
        <h2 className="mb-3 text-sm font-semibold text-ink">Announcements</h2>
        {updateError && <div className="mb-3"><Alert tone="error">{updateError}</Alert></div>}
        {(groupTrip.announcements || []).length === 0 ? (
          <p className="text-xs text-ash">No announcements yet.</p>
        ) : (
          <div className="mb-3 space-y-2">
            {groupTrip.announcements.map((a, i) => (
              <div key={i} className="rounded-lg border border-paper-dim px-3 py-2 text-sm text-ink/80">{a.text}</div>
            ))}
          </div>
        )}
        {(isCreator || isActiveMember) && (
          <form onSubmit={postAnnouncement} className="flex gap-2">
            <input value={announcementText} onChange={(e) => setAnnouncementText(e.target.value)} placeholder="Post an update to the squad" className={inputClass} />
            <Button type="submit" size="sm" loading={isUpdating}>Post</Button>
          </form>
        )}
      </Card>

      {(isCreator || isActiveMember) && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-ink">In-trip support</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Link to="/safety"><Button variant="outline" size="sm" icon={ShieldCheck} fullWidth>Safety</Button></Link>
            <Link to="/visits"><Button variant="outline" size="sm" icon={BadgeCheck} fullWidth>Verify a visit</Button></Link>
            <Link to={`/explore/${groupTrip.destId}`}><Button variant="outline" size="sm" icon={Compass} fullWidth>Destination info</Button></Link>
          </div>
        </Card>
      )}
    </div>
  )
}
