import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, Star, ShieldCheck, ChevronRight } from 'lucide-react'
import { useWorkerStore } from '../../store/useWorkerStore'
import { workerSkillLabel } from '../../lib/labels'
import { getDestinationLabel } from '../../lib/destinations'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import LoadingState from '../ui/LoadingState'

const RATE_UNIT_LABEL = { day: '/day', trip: '/trip', hour: '/hr' }

// A worker's Profile previously showed literally nothing about being a
// worker -- skills, rating, and rate all only existed inside Worker
// Console's own Profile tab, one click away but invisible from the account
// page every other role's meaningful info lives on. Real data (GET
// /v1/workers/me for the profile, GET /v1/workers/me/gigs for the
// completed-job count), not duplicated here as a second editable form --
// editing still happens in Worker Console, this is the "what do I
// actually have set up, and how much work have I done" snapshot.
export default function WorkerSnapshotCard() {
  const { profile, isLoadingProfile, hasCheckedProfile, fetchMyProfile, myGigs, fetchMyGigs } = useWorkerStore()

  useEffect(() => {
    fetchMyProfile()
    fetchMyGigs()
  }, [fetchMyProfile, fetchMyGigs])

  const completedCount = myGigs.filter((row) => row.match.status === 'completed').length

  return (
    <Card className="mb-4">
      <div className="mb-3 flex items-center gap-2">
        <Briefcase size={16} className="text-relief" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-ink">Your worker profile</h2>
      </div>

      {!hasCheckedProfile && isLoadingProfile ? (
        <LoadingState label="Loading…" />
      ) : !profile ? (
        <div>
          <p className="mb-3 text-sm text-ink/50">No worker profile yet -- skills and service area are how gigs actually find you.</p>
          <Link to="/worker"><Button variant="primary" size="sm">Set up your profile</Button></Link>
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {profile.skills.length === 0 ? (
              <span className="text-xs text-ash">No skills added yet</span>
            ) : (
              profile.skills.map((s) => <Badge key={s} tone="info">{workerSkillLabel(s)}</Badge>)
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <p className="flex items-center gap-1 text-xs text-ash"><Star size={12} aria-hidden="true" /> Rating</p>
              <p className="mt-0.5 font-medium text-ink">{profile.rating.count > 0 ? `${profile.rating.avg.toFixed(1)} ★ (${profile.rating.count})` : 'No ratings yet'}</p>
            </div>
            <div>
              <p className="flex items-center gap-1 text-xs text-ash"><ShieldCheck size={12} aria-hidden="true" /> Verification</p>
              <p className="mt-0.5 font-medium capitalize text-ink">{profile.verificationTier}</p>
            </div>
            <div>
              <p className="text-xs text-ash">Available</p>
              <p className="mt-0.5 font-medium text-ink">{profile.availability?.mode === 'now' ? 'Right now' : `${profile.availability?.windows?.length || 0} date(s) set`}</p>
            </div>
            <div>
              <p className="text-xs text-ash">Completed gigs</p>
              <p className="mt-0.5 font-medium text-ink">{completedCount}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-ash">
            {(profile.rateExpectation?.min != null || profile.rateExpectation?.max != null) && (
              <span>Rate: ₹{profile.rateExpectation.min ?? '?'}–{profile.rateExpectation.max ?? '?'}{RATE_UNIT_LABEL[profile.rateExpectation.unit] || ''}</span>
            )}
            {profile.languages.length > 0 && <span>Languages: {profile.languages.join(', ')}</span>}
            {profile.serviceAreaDestIds.length > 0 && <span>Service area: {profile.serviceAreaDestIds.map(getDestinationLabel).join(', ')}</span>}
          </div>
        </>
      )}

      <Link to="/worker" className="mt-3 flex items-center gap-1 text-xs font-medium text-ink/60 hover:text-ink">
        Manage skills, availability & jobs in Worker Console <ChevronRight size={12} aria-hidden="true" />
      </Link>
    </Card>
  )
}
