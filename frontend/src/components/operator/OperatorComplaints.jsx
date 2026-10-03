import { useEffect } from 'react'
import { ClipboardList } from 'lucide-react'
import { useOperatorStore } from '../../store/useOperatorStore'
import { OPERATOR_COMPLAINT_CATEGORIES } from '../../lib/labels'
import ComplaintReport from '../trust/safety/ComplaintReport'
import PageHeader from '../ui/PageHeader'

// Operators previously had no way to raise a complaint at all -- the
// backend endpoint (POST /v1/safety/complaints) was always open to any
// signed-in account, but nothing in the operator nav pointed at it. Reuses
// the same shared infrastructure travellers use (ComplaintReport.jsx), but
// with an operator's own category vocabulary and copy: an operator
// reporting something is a traveller dispute, an unfair review, a billing
// issue, or a platform/policy problem -- never "overcharging" or "hygiene",
// which only make sense from the traveller's side of the same collection.
// Also offers an optional "which of my businesses is this about" picker,
// which the traveller-facing form has no equivalent for.
export default function OperatorComplaints() {
  const { myBusinesses, fetchMyBusinesses } = useOperatorStore()
  useEffect(() => { fetchMyBusinesses() }, [fetchMyBusinesses])

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader icon={ClipboardList} title="Raise a complaint" description="Flag a traveller dispute, an unfair review, a billing issue, or anything else that needs authority attention. Logged for platform review, not sent to any government authority." />
      <ComplaintReport
        categories={OPERATOR_COMPLAINT_CATEGORIES}
        title="Report an issue"
        description="Traveller disputes, unfair reviews, billing problems, or platform/policy concerns -- logged for platform review."
        businesses={myBusinesses}
      />
    </div>
  )
}
