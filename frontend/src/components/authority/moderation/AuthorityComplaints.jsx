import { ClipboardList } from 'lucide-react'
import ComplaintsModeration from './ComplaintsModeration'
import PageHeader from '../../ui/PageHeader'

// Complaints used to be one tab buried inside the Authority Dashboard's
// four analytics sections -- fine when only travellers filed them, but now
// travellers, operators, AND workers can all raise a complaint (see
// ComplaintReport.jsx's shared infrastructure), so the moderation queue is
// a real, standing workload of its own -- promoted to its own workspace
// destination instead of a tab an authority might not even open.
export default function AuthorityComplaints() {
  return (
    <div>
      <PageHeader icon={ClipboardList} title="Complaints" description="Every complaint filed by a traveller, operator, or worker, in one moderation queue." />
      <ComplaintsModeration />
    </div>
  )
}
