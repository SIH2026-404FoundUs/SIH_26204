import { useState } from 'react'
import { MapPinned } from 'lucide-react'
import { useTrustStore } from '../../store/useTrustStore'
import { submissionStatus } from '../../lib/labels'
import PageHeader from '../ui/PageHeader'
import Card from '../ui/Card'
import Button from '../ui/Button'
import Alert from '../ui/Alert'
import Badge from '../ui/Badge'
import FormField, { inputClass } from '../ui/FormField'

/** Submitting a place that isn't tracked yet. Requires a verified visit somewhere on the platform first. */
export default function CommunitySubmit() {
  const { submitCommunityPlace, isSubmittingPlace, communityResult, communityError } = useTrustStore()
  const [form, setForm] = useState({ name: '', lat: '', lng: '', description: '' })

  function update(field) {
    return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    await submitCommunityPlace({ name: form.name, lat: Number(form.lat), lng: Number(form.lng), description: form.description })
  }

  const submission = communityResult?.success ? communityResult.submission : null

  return (
    <div className="mx-auto max-w-md">
      <PageHeader
        icon={MapPinned}
        title="Suggest a place"
        description="Found somewhere worth adding to the map? Submit it here. You'll need at least one verified visit anywhere on the platform to submit — this keeps suggestions coming from real travellers."
      />

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Place name">
            <input value={form.name} onChange={update('name')} required placeholder="e.g. Hidden waterfall" className={inputClass} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Latitude">
              <input value={form.lat} onChange={update('lat')} required type="number" step="any" placeholder="32.24" className={inputClass} />
            </FormField>
            <FormField label="Longitude">
              <input value={form.lng} onChange={update('lng')} required type="number" step="any" placeholder="77.19" className={inputClass} />
            </FormField>
          </div>
          <FormField label="What makes it worth visiting?" optional>
            <textarea value={form.description} onChange={update('description')} rows={3} className={inputClass} />
          </FormField>
          <Button type="submit" variant="primary" fullWidth loading={isSubmittingPlace}>Submit for review</Button>
        </form>
      </Card>

      {communityError && <div className="mt-4"><Alert tone="error">{communityError}</Alert></div>}

      {submission && (
        <div className="mt-4">
          <Alert tone="success" action={<Badge tone={submissionStatus(submission.status).tone}>{submissionStatus(submission.status).label}</Badge>}>
            Submitted. An admin will review it before it appears on the map.
          </Alert>
        </div>
      )}
    </div>
  )
}
