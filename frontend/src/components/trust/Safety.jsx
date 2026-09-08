import { useState } from 'react'
import { Phone, Search } from 'lucide-react'
import { useTrustStore } from '../../store/useTrustStore'
import { complaintCategoryLabel, COMPLAINT_CATEGORY_LABEL } from '../../lib/labels'
import PageHeader from '../ui/PageHeader'
import Card from '../ui/Card'
import Button from '../ui/Button'
import Alert from '../ui/Alert'
import FormField, { inputClass } from '../ui/FormField'
import DestinationSelect from '../ui/DestinationSelect'

const CONTACT_LABELS = {
  police: 'Police', ambulance: 'Ambulance', disasterHelpline: 'Disaster helpline',
  controlRoom: 'Control room', touristPolice: 'Tourist police',
}

export default function Safety() {
  const {
    emergencyContacts, fetchEmergencyContacts,
    submitComplaint, isSubmittingComplaint, complaintResult, safetyError,
  } = useTrustStore()

  const [destId, setDestId] = useState('manali')
  const [complaint, setComplaint] = useState({ destId: 'manali', category: 'other', text: '' })

  async function handleComplaint(e) {
    e.preventDefault()
    await submitComplaint(complaint)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <div>
        <PageHeader icon={Phone} title="Emergency contacts" description="Local police, ambulance, and disaster helpline numbers for a destination." />
        <form onSubmit={(e) => { e.preventDefault(); fetchEmergencyContacts(destId) }} className="mb-4 flex items-end gap-3">
          <div className="flex-1"><FormField label="Destination"><DestinationSelect value={destId} onChange={setDestId} /></FormField></div>
          <Button type="submit" variant="primary" icon={Search}>Look up</Button>
        </form>
        {emergencyContacts && (
          <Card>
            <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              {Object.entries(CONTACT_LABELS).map(([key, label]) =>
                emergencyContacts[key] ? (
                  <div key={key}>
                    <p className="text-xs text-ash">{label}</p>
                    <p className="font-medium text-ink">{emergencyContacts[key]}</p>
                  </div>
                ) : null
              )}
            </div>
          </Card>
        )}
      </div>

      <div>
        <PageHeader title="Report a problem" description="Overcharging, safety concerns, or anything else that needs flagging. Logged for platform review -- not sent to any government authority." />
        <Card>
          <form onSubmit={handleComplaint} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Destination"><DestinationSelect value={complaint.destId} onChange={(v) => setComplaint((p) => ({ ...p, destId: v }))} /></FormField>
              <FormField label="Category">
                <select value={complaint.category} onChange={(e) => setComplaint((p) => ({ ...p, category: e.target.value }))} className={inputClass}>
                  {Object.keys(COMPLAINT_CATEGORY_LABEL).map((c) => <option key={c} value={c}>{complaintCategoryLabel(c)}</option>)}
                </select>
              </FormField>
            </div>
            <FormField label="What happened?">
              <textarea required rows={3} value={complaint.text} onChange={(e) => setComplaint((p) => ({ ...p, text: e.target.value }))} className={inputClass} />
            </FormField>
            <Button type="submit" variant="primary" fullWidth loading={isSubmittingComplaint}>Submit</Button>
          </form>
        </Card>
        {safetyError && <div className="mt-4"><Alert tone="error">{safetyError}</Alert></div>}
        {complaintResult?.success && <div className="mt-4"><Alert tone="success">Report submitted. {complaintResult.disclaimer}</Alert></div>}
      </div>
    </div>
  )
}
