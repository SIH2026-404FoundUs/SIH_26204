import { useEffect, useState } from 'react'
import { Briefcase, Users, CalendarDays, IndianRupee, Star } from 'lucide-react'
import { useOperatorStore } from '../../store/useOperatorStore'
import { workerSkillLabel, gigRequestStatus, WORKER_SKILL_LABEL } from '../../lib/labels'
import { getDestinationLabel } from '../../lib/destinations'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Alert from '../ui/Alert'
import LoadingState from '../ui/LoadingState'
import EmptyState from '../ui/EmptyState'
import FormField, { inputClass } from '../ui/FormField'
import DestinationSelect from '../ui/DestinationSelect'

const POLL_MS = 15_000
const SKILLS = Object.keys(WORKER_SKILL_LABEL)
const today = () => new Date().toISOString().slice(0, 10)
const dayLabel = (v) => (v ? new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

function RateWorkerForm({ gigId, onSubmit, isSubmitting }) {
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
      <Button type="submit" variant="outline" size="sm" loading={isSubmitting}>Rate worker(s)</Button>
    </form>
  )
}

function PostedGigCard({ gig, onComplete, onRate, isCompleting, isRating }) {
  const state = gigRequestStatus(gig.status)
  const canComplete = gig.acceptedCount > 0 && gig.completedCount < gig.acceptedCount
  const canRate = gig.completedCount > 0
  return (
    <Card padding="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-ink">{workerSkillLabel(gig.skillNeeded)} · {getDestinationLabel(gig.destId)}</p>
          <p className="flex items-center gap-1 text-xs text-ash"><CalendarDays size={12} aria-hidden="true" /> {dayLabel(gig.startDate)} – {dayLabel(gig.endDate)}</p>
        </div>
        <Badge tone={state.tone}>{state.label}</Badge>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-ink/70">
        <span className="flex items-center gap-1"><Users size={12} aria-hidden="true" /> {gig.headcount} needed</span>
        <span>{gig.offeredCount} offered</span>
        <span>{gig.acceptedCount} accepted</span>
        <span>{gig.completedCount} completed</span>
      </div>
      {gig.notes && <p className="mt-2 text-xs text-ash">{gig.notes}</p>}
      {canComplete && (
        <Button variant="primary" size="sm" className="mt-3" loading={isCompleting} onClick={() => onComplete(gig._id)}>Mark gig complete</Button>
      )}
      {canRate && <RateWorkerForm gigId={gig._id} isSubmitting={isRating} onSubmit={onRate} />}
    </Card>
  )
}

// Operator's one addition (worker-role-spec.md §06): "Post a Gig -- skill,
// dates, headcount, budget. Same shape as the existing Register Business
// form, one step shorter." Posting immediately fans out to matching
// workers (push-first, spec §04) -- this also doubles as "Track posted
// gigs & status" (GET /v1/operators/me/gigs) since both are the same
// small feature from the same actor. Lives as a tab inside HirePeople.jsx
// (merged there, not a separate route/nav entry) since hiring a gig worker
// and hiring an already-listed one are the same underlying need.
export default function PostGig() {
  const {
    postedGigs, isLoadingPostedGigs, postedGigsError, fetchPostedGigs,
    isPostingGig, postGigError, lastPostedGigNotifiedCount, postGig,
    isCompletingGig, completeGigError, completeGig,
    isRatingGig, rateGig,
  } = useOperatorStore()

  const [form, setForm] = useState({ destId: '', skillNeeded: 'driver', startDate: '', endDate: '', headcount: 1, budgetMin: '', budgetMax: '', notes: '' })

  useEffect(() => {
    fetchPostedGigs()
    const interval = setInterval(() => fetchPostedGigs({ silent: true }), POLL_MS)
    return () => clearInterval(interval)
  }, [fetchPostedGigs])

  async function handleSubmit(e) {
    e.preventDefault()
    const result = await postGig({
      destId: form.destId,
      skillNeeded: form.skillNeeded,
      startDate: form.startDate,
      endDate: form.endDate,
      headcount: Number(form.headcount) || 1,
      budget: { min: Number(form.budgetMin) || undefined, max: Number(form.budgetMax) || undefined },
      notes: form.notes,
    })
    if (result) setForm((prev) => ({ ...prev, notes: '' }))
  }

  return (
    <div>
      <p className="mb-4 text-sm text-ash">Need a driver, guide, cook, or cleaner for a few days? Post it here -- every matching, available worker gets notified immediately.</p>

      <Card className="mb-6">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Destination"><DestinationSelect value={form.destId} onChange={(v) => setForm((p) => ({ ...p, destId: v }))} required /></FormField>
          <FormField label="Skill needed">
            <select value={form.skillNeeded} onChange={(e) => setForm((p) => ({ ...p, skillNeeded: e.target.value }))} className={inputClass}>
              {SKILLS.map((s) => <option key={s} value={s}>{workerSkillLabel(s)}</option>)}
            </select>
          </FormField>
          <FormField label="Start date"><input type="date" min={today()} value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} required className={inputClass} /></FormField>
          <FormField label="End date"><input type="date" min={form.startDate || today()} value={form.endDate} onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))} required className={inputClass} /></FormField>
          <FormField label="Headcount"><input type="number" min="1" value={form.headcount} onChange={(e) => setForm((p) => ({ ...p, headcount: e.target.value }))} className={inputClass} /></FormField>
          <FormField label="Budget (INR)" optional>
            <div className="flex gap-2">
              <input type="number" min="0" placeholder="Min" value={form.budgetMin} onChange={(e) => setForm((p) => ({ ...p, budgetMin: e.target.value }))} className={inputClass} />
              <input type="number" min="0" placeholder="Max" value={form.budgetMax} onChange={(e) => setForm((p) => ({ ...p, budgetMax: e.target.value }))} className={inputClass} />
            </div>
          </FormField>
          <div className="sm:col-span-2"><FormField label="Notes" optional><textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={2} className={inputClass} placeholder="Anything a worker should know before accepting" /></FormField></div>
          <div className="sm:col-span-2">
            {postGigError && <div className="mb-3"><Alert tone="error">{postGigError}</Alert></div>}
            {lastPostedGigNotifiedCount != null && (
              <div className="mb-3"><Alert tone={lastPostedGigNotifiedCount > 0 ? 'success' : 'warning'}>
                {lastPostedGigNotifiedCount > 0 ? `Notified ${lastPostedGigNotifiedCount} matching worker(s).` : 'Posted, but no workers currently match this skill/destination/dates -- it still stays open for anyone browsing.'}
              </Alert></div>
            )}
            <Button type="submit" variant="primary" icon={IndianRupee} loading={isPostingGig}>Post gig</Button>
          </div>
        </form>
      </Card>

      <h2 className="mb-3 text-sm font-semibold text-ink">Your posted gigs</h2>
      {postedGigsError && <div className="mb-4"><Alert tone="error">{postedGigsError}</Alert></div>}
      {completeGigError && <div className="mb-4"><Alert tone="error">{completeGigError}</Alert></div>}
      {isLoadingPostedGigs ? (
        <LoadingState label="Loading your posted gigs…" />
      ) : postedGigs.length === 0 ? (
        <EmptyState icon={Briefcase} title="No gigs posted yet" description="Once you post one above, track its fill progress here." />
      ) : (
        <div className="space-y-3">
          {postedGigs.map((gig) => (
            <PostedGigCard
              key={gig._id}
              gig={gig}
              onComplete={completeGig}
              onRate={rateGig}
              isCompleting={isCompletingGig}
              isRating={isRatingGig}
            />
          ))}
        </div>
      )}
    </div>
  )
}
