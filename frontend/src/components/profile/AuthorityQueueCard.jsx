import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardCheck, ClipboardList, ChevronRight } from 'lucide-react'
import { useTrustStore } from '../../store/useTrustStore'
import Card from '../ui/Card'

// An authority's Profile previously had zero role-specific content -- just
// "your account details," identical to what a traveller sees minus travel
// preferences. This is real, live data: every complaint ever logged (GET
// /v1/safety/complaints, no status filter -- the same collection
// Authority Dashboard's Complaints tab reads), broken down by where it
// stands, plus the community-submission review queue (GET
// /community/submissions/queued). There's no per-authority-account
// attribution anywhere in this codebase (AuditLog records the action, not
// which authority did it), so this only ever claims what's honestly
// countable: the state of the shared queue, not fabricated "your own"
// activity.
export default function AuthorityQueueCard() {
  const { allComplaints, isLoadingAllComplaints, fetchAllComplaints, queuedSubmissions, isLoadingQueue, fetchQueuedSubmissions } = useTrustStore()

  useEffect(() => {
    fetchAllComplaints({})
    fetchQueuedSubmissions()
  }, [fetchAllComplaints, fetchQueuedSubmissions])

  const counts = {
    logged: allComplaints.filter((c) => c.status === 'logged').length,
    under_review: allComplaints.filter((c) => c.status === 'under_review').length,
    resolved: allComplaints.filter((c) => c.status === 'resolved').length,
  }

  return (
    <Card className="mb-4">
      <h2 className="mb-3 text-sm font-semibold text-ink">Your review queue</h2>

      <div className="mb-4">
        <div className="mb-2 flex items-center gap-1.5 text-ash"><ClipboardList size={13} aria-hidden="true" /><span className="text-xs font-medium">Complaints ({isLoadingAllComplaints ? '…' : allComplaints.length} total)</span></div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg bg-paper-dim/40 py-2"><p className="font-display text-lg text-ink">{counts.logged}</p><p className="text-[10px] uppercase tracking-wide text-ash">Logged</p></div>
          <div className="rounded-lg bg-paper-dim/40 py-2"><p className="font-display text-lg text-ink">{counts.under_review}</p><p className="text-[10px] uppercase tracking-wide text-ash">Under review</p></div>
          <div className="rounded-lg bg-paper-dim/40 py-2"><p className="font-display text-lg text-relief">{counts.resolved}</p><p className="text-[10px] uppercase tracking-wide text-ash">Resolved</p></div>
        </div>
      </div>

      <Link to="/community" className="flex items-center justify-between rounded-lg border border-paper-dim px-3 py-2.5 transition hover:border-ink/25">
        <span className="flex items-center gap-1.5 text-sm text-ink"><ClipboardCheck size={14} className="text-ash" aria-hidden="true" /> Community submissions awaiting review</span>
        <span className="font-display text-lg text-ink">{isLoadingQueue ? '…' : queuedSubmissions.length}</span>
      </Link>

      <Link to="/authority" className="mt-3 flex items-center gap-1 text-xs font-medium text-ink/60 hover:text-ink">
        Open Authority Dashboard <ChevronRight size={12} aria-hidden="true" />
      </Link>
    </Card>
  )
}
