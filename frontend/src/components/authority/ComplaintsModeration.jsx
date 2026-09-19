import { useEffect, useState } from 'react'
import { ClipboardList } from 'lucide-react'
import { useTrustStore } from '../../store/useTrustStore'
import { complaintCategoryLabel, complaintStatus, COMPLAINT_STATUS } from '../../lib/labels'
import { getDestinationLabel } from '../../lib/destinations'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Alert from '../ui/Alert'
import LoadingState from '../ui/LoadingState'
import EmptyState from '../ui/EmptyState'

const POLL_MS = 15_000

// Every complaint a traveller ever submits, with real status controls --
// GET /v1/safety/complaints + PATCH .../:id/status existed with zero
// frontend consumer before this: complaints were created "logged" and
// stayed there forever, and no authority could even see them all in one
// place. Moving a complaint to "under_review"/"resolved" here really
// emails the submitter (safety.controller.js), not a local-only flag.
export default function ComplaintsModeration() {
  const { allComplaints, isLoadingAllComplaints, isUpdatingComplaintStatus, moderationError, fetchAllComplaints, updateComplaintStatus } = useTrustStore()
  const [filter, setFilter] = useState('')

  useEffect(() => {
    fetchAllComplaints({ status: filter })
    const interval = setInterval(() => fetchAllComplaints({ status: filter, silent: true }), POLL_MS)
    return () => clearInterval(interval)
  }, [filter, fetchAllComplaints])

  return (
    <Card className="mb-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardList size={17} className="text-pressure" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-ink">Complaints</h2>
        </div>
        <div className="flex gap-1">
          {[['', 'All'], ...Object.entries(COMPLAINT_STATUS).map(([k, v]) => [k, v.label])].map(([value, label]) => (
            <button
              key={value || 'all'}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${filter === value ? 'border-ink bg-ink text-paper' : 'border-paper-dim text-ink/60 hover:border-ink/30'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {moderationError && <div className="mb-3"><Alert tone="error">{moderationError}</Alert></div>}

      {isLoadingAllComplaints ? (
        <LoadingState label="Loading complaints…" />
      ) : allComplaints.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Nothing here" description={filter ? `No complaints are currently "${complaintStatus(filter).label.toLowerCase()}".` : 'No complaints have been submitted yet.'} />
      ) : (
        <div className="space-y-2">
          {allComplaints.map((c) => {
            const status = complaintStatus(c.status)
            return (
              <div key={c._id} className="rounded-lg border border-paper-dim p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-ink">{complaintCategoryLabel(c.category)} · {getDestinationLabel(c.destId)}</p>
                    <p className="mt-1 text-xs text-ink/60">{c.text}</p>
                    <p className="mt-1 text-[11px] text-ash">{new Date(c.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}</p>
                  </div>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </div>
                {c.status !== 'resolved' && (
                  <div className="mt-3 flex gap-1.5 border-t border-paper-dim pt-3">
                    {c.status !== 'under_review' && (
                      <Button size="sm" variant="outline" loading={isUpdatingComplaintStatus} onClick={() => updateComplaintStatus(c._id, 'under_review')}>
                        Mark under review
                      </Button>
                    )}
                    <Button size="sm" variant="relief" loading={isUpdatingComplaintStatus} onClick={() => updateComplaintStatus(c._id, 'resolved')}>
                      Mark resolved
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
