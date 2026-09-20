import { useEffect, useState } from 'react'
import { ListChecks, Star } from 'lucide-react'
import { useWorkerStore } from '../../store/useWorkerStore'
import { workerSkillLabel, gigMatchStatus } from '../../lib/labels'
import { getDestinationLabel } from '../../lib/destinations'
import PageHeader from '../ui/PageHeader'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Alert from '../ui/Alert'
import LoadingState from '../ui/LoadingState'
import EmptyState from '../ui/EmptyState'
import { inputClass } from '../ui/FormField'

const POLL_MS = 15_000 // same live-data cadence Worker Console's own tabs used
const dayLabel = (v) => (v ? new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

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

// Moved out of Worker Console's tab bar into its own page, reached from the
// profile dropdown -- same relocation My Trips already got for travellers
// (Header.jsx's ProfileMenu): a job-history list is something you check in
// on occasionally, not the tab you land on, so it doesn't need a permanent
// slot next to Gigs Near You / Profile.
export default function WorkerMyJobs() {
  const { myGigs, isLoadingMyGigs, myGigsError, fetchMyGigs, isCompleting, completeError, completeGig, isRating, rateGig } = useWorkerStore()
  const [queuedGigId, setQueuedGigId] = useState(null)

  useEffect(() => {
    fetchMyGigs()
    const interval = setInterval(() => fetchMyGigs({ silent: true }), POLL_MS)
    return () => clearInterval(interval)
  }, [fetchMyGigs])

  async function handleComplete(gigId) {
    const result = await completeGig(gigId)
    setQueuedGigId(result.queued ? gigId : null)
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader icon={ListChecks} title="My jobs" description="Gigs you're offered, accept, or complete -- and rating the operator once a job's done." />

      {isLoadingMyGigs ? (
        <LoadingState label="Loading your jobs…" />
      ) : myGigsError ? (
        <Alert tone="error">{myGigsError}</Alert>
      ) : myGigs.length === 0 ? (
        <EmptyState icon={ListChecks} title="No jobs yet" description="Gigs you're offered, accept, or complete will show up here." />
      ) : (
        <div className="space-y-3">
          {completeError && <Alert tone="error">{completeError}</Alert>}
          {queuedGigId && <Alert tone="warning">No connection right now -- this will be marked complete automatically once you're back online.</Alert>}
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
                  <Button variant="primary" size="sm" className="mt-3" loading={isCompleting === String(gig._id)} onClick={() => handleComplete(gig._id)}>Mark complete</Button>
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
      )}
    </div>
  )
}
