import { useEffect, useState } from 'react'
import { ClipboardCheck, Check, X, Flag, MapPin } from 'lucide-react'
import { useTrustStore } from '../../store/useTrustStore'
import { submissionStatus } from '../../lib/labels'
import PageHeader from '../ui/PageHeader'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Alert from '../ui/Alert'
import EmptyState from '../ui/EmptyState'
import LoadingState from '../ui/LoadingState'

const POLL_MS = 15_000 // matches Suggest a Place's own poll -- a new submission shows up here without a manual reload

// Authority-facing "Community Review" -- the moderation UI the spec
// requires (§18/§19) for traveller-submitted "Suggest a Place" entries.
// Same queue/review endpoints and status machine as before (GET
// /community/submissions/queued, POST /community/submissions/:id/review,
// now also accepting action:"flag"); nothing here is a new/disconnected
// moderation system. Deliberately never renders _id/userId as visible
// text -- the submission's Mongo _id is only ever used internally as the
// key for the review call, never shown to the authority.
export default function CommunityReview() {
  const { queuedSubmissions, isLoadingQueue, isReviewing, moderationError, fetchQueuedSubmissions, reviewSubmission } = useTrustStore()
  const [reasonDrafts, setReasonDrafts] = useState({}) // submissionId -> in-progress rejection/flag reason text
  const [actingOn, setActingOn] = useState(null) // {submissionId, action} while a review request is in flight

  useEffect(() => {
    fetchQueuedSubmissions()
    const interval = setInterval(() => fetchQueuedSubmissions({ silent: true }), POLL_MS)
    return () => clearInterval(interval)
  }, [fetchQueuedSubmissions])

  async function handleReview(submissionId, action) {
    const reason = reasonDrafts[submissionId]?.trim()
    setActingOn({ submissionId, action })
    await reviewSubmission(submissionId, action, reason || undefined)
    setActingOn(null)
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        icon={ClipboardCheck}
        title="Community review"
        description="Places travellers have suggested via Suggest a Place, awaiting your decision before they can appear on the map."
      />

      {moderationError && <div className="mb-4"><Alert tone="error">{moderationError}</Alert></div>}

      {isLoadingQueue ? (
        <LoadingState label="Loading the review queue…" />
      ) : queuedSubmissions.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="Nothing to review" description="No suggested places are waiting on a decision right now." />
      ) : (
        <div className="space-y-4">
          {queuedSubmissions.map((s) => {
            const status = submissionStatus(s.status)
            const isActing = isReviewing && actingOn?.submissionId === s._id
            const mapHref = s.location ? `https://www.google.com/maps?q=${s.location.lat},${s.location.lng}` : null
            return (
              <Card key={s._id} padding="p-4">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-lg text-ink">{s.name}</p>
                    <p className="text-xs text-ash">Submitted {new Date(s.createdAt).toLocaleDateString()}</p>
                  </div>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </div>

                {mapHref && (
                  <a href={mapHref} target="_blank" rel="noreferrer" className="mb-2 inline-flex items-center gap-1 text-xs text-pressure hover:underline">
                    <MapPin size={13} aria-hidden="true" /> View location on map
                  </a>
                )}

                {s.description && <p className="mb-3 text-sm text-ink/80">{s.description}</p>}

                {s.photos?.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {s.photos.map((url) => (
                      <img key={url} src={url} alt="" className="h-20 w-20 rounded-lg object-cover" />
                    ))}
                  </div>
                )}

                <label className="mb-2 block text-left">
                  <span className="mb-1 block text-xs font-medium text-ink/70">Reason (required to reject or flag)</span>
                  <input
                    value={reasonDrafts[s._id] || ''}
                    onChange={(e) => setReasonDrafts((prev) => ({ ...prev, [s._id]: e.target.value }))}
                    placeholder="Optional for approve, required to reject/flag"
                    className="w-full rounded-lg border border-paper-dim bg-white px-3 py-2 text-sm text-ink outline-none focus:border-ink/40 focus:ring-4 focus:ring-ink/10"
                  />
                </label>

                <div className="flex flex-wrap gap-2">
                  <Button variant="relief" size="sm" icon={Check} loading={isActing && actingOn.action === 'approve'} disabled={isReviewing} onClick={() => handleReview(s._id, 'approve')}>
                    Approve
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    icon={X}
                    loading={isActing && actingOn.action === 'reject'}
                    disabled={isReviewing || !reasonDrafts[s._id]?.trim()}
                    onClick={() => handleReview(s._id, 'reject')}
                  >
                    Reject
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={Flag}
                    loading={isActing && actingOn.action === 'flag'}
                    disabled={isReviewing || !reasonDrafts[s._id]?.trim()}
                    onClick={() => handleReview(s._id, 'flag')}
                  >
                    Flag harmful / unethical
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
