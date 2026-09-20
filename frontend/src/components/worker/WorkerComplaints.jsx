import { ClipboardList } from 'lucide-react'
import { WORKER_COMPLAINT_CATEGORIES } from '../../lib/labels'
import ComplaintReport from '../trust/ComplaintReport'
import PageHeader from '../ui/PageHeader'

// Same shared infrastructure travellers and operators already raise
// complaints through (ComplaintReport.jsx, POST /v1/safety/complaints --
// never role-restricted server-side), but with a worker's own category
// vocabulary: a worker reporting something is about the gig relationship --
// non-payment, unsafe conditions, an unfair rating, a dispute with an
// operator -- never overcharging or hygiene, which only make sense from a
// traveller's side of the same collection.
export default function WorkerComplaints() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader icon={ClipboardList} title="Raise a complaint" description="Flag a gig dispute, non-payment, unsafe conditions, or anything else that needs authority attention. Logged for platform review, not sent to any government authority." />
      <ComplaintReport
        categories={WORKER_COMPLAINT_CATEGORIES}
        title="Report an issue"
        description="Gig disputes, non-payment, unsafe conditions, or an unfair rating -- logged for platform review."
      />
    </div>
  )
}
