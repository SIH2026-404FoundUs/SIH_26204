import { useEffect, useState } from 'react'
import { ClipboardList } from 'lucide-react'
import { useTrustStore } from '../../store/useTrustStore'
import { complaintCategoryLabel, TRAVELLER_COMPLAINT_CATEGORIES, complaintStatus } from '../../lib/labels'
import { getDestinationLabel } from '../../lib/destinations'
import Card from '../ui/Card'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import Alert from '../ui/Alert'
import EmptyState from '../ui/EmptyState'
import LoadingState from '../ui/LoadingState'
import FormField, { inputClass } from '../ui/FormField'
import DestinationSelect from '../ui/DestinationSelect'

// Submit a complaint + track its status (logged/under_review/resolved, no
// auto-resolution) -- role-agnostic infrastructure (POST /v1/safety/complaints
// and GET /v1/safety/complaints/mine are gated only on being signed in, no
// requireRole), shared between the traveller-facing Safety page's "Report"
// tab and the operator's own "Raise a Complaint" page. What's NOT shared
// is the category vocabulary or copy: an operator reporting something is
// never complaining about being overcharged or served badly the way a
// traveller would, so `categories`/`title`/`description` are caller-
// supplied (defaulting to the traveller shape) rather than one generic
// form pretending to fit both. `businesses`, when passed, adds an
// operator-only "which of your listings is this about" picker --
// optional, since not every operator report is tied to one.
export default function ComplaintReport({
  categories = TRAVELLER_COMPLAINT_CATEGORIES,
  title = 'Report a problem',
  description = 'Overcharging, safety concerns, or anything else that needs flagging. Logged for platform review -- not sent to any government authority.',
  businesses = null,
}) {
  const {
    submitComplaint, isSubmittingComplaint, complaintResult, safetyError,
    myComplaints, isLoadingComplaints, fetchMyComplaints,
  } = useTrustStore()
  const [complaint, setComplaint] = useState({ destId: 'manali', category: categories[0], text: '', businessId: '' })

  useEffect(() => { fetchMyComplaints() }, [fetchMyComplaints])

  async function handleComplaint(e) {
    e.preventDefault()
    const ok = await submitComplaint({ ...complaint, businessId: complaint.businessId || undefined })
    if (ok) setComplaint((p) => ({ ...p, text: '' }))
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <ClipboardList size={17} className="text-pressure" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-semibold text-ink">{title}</h2>
            <p className="text-xs text-ash">{description}</p>
          </div>
        </div>
        <form onSubmit={handleComplaint} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Destination"><DestinationSelect value={complaint.destId} onChange={(v) => setComplaint((p) => ({ ...p, destId: v }))} /></FormField>
            <FormField label="Category">
              <select value={complaint.category} onChange={(e) => setComplaint((p) => ({ ...p, category: e.target.value }))} className={inputClass}>
                {categories.map((c) => <option key={c} value={c}>{complaintCategoryLabel(c)}</option>)}
              </select>
            </FormField>
          </div>
          {businesses && (
            <FormField label="Which business?" optional hint="Leave unset if this isn't about one specific listing">
              <select value={complaint.businessId} onChange={(e) => setComplaint((p) => ({ ...p, businessId: e.target.value }))} className={inputClass}>
                <option value="">Not tied to a specific business</option>
                {businesses.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
              </select>
            </FormField>
          )}
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
