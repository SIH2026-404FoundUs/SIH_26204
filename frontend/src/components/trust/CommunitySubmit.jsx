import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapPinned, Upload, X, Users } from 'lucide-react'
import { useTrustStore } from '../../store/useTrustStore'
import { submissionStatus } from '../../lib/labels'
import PageHeader from '../ui/PageHeader'
import Card from '../ui/Card'
import Button from '../ui/Button'
import Alert from '../ui/Alert'
import Badge from '../ui/Badge'
import FormField, { inputClass } from '../ui/FormField'
import LocationPickerMap from './LocationPickerMap'

const POLL_MS = 15_000 // matches the operator pages -- an authority's review can land while this is open

// "Suggest a Place" -- the traveller-facing rename and UX rebuild of what
// was "Community"/CommunitySubmit. Same backend contract throughout
// (POST /community/submissions, POST /community/photos): only the UI
// changed -- a real map replaces manual lat/lng inputs, and photo upload
// (optional, via the project's existing Cloudinary integration) was added.
export default function CommunitySubmit() {
  const {
    submitCommunityPlace, uploadCommunityPhotos, isSubmittingPlace, isUploadingPhotos, communityResult, communityError,
    mySubmissions, fetchMySubmissions,
  } = useTrustStore()
  const [name, setName] = useState('')
  const [location, setLocation] = useState(null)
  const [state, setState] = useState('')
  const [description, setDescription] = useState('')
  const [photoFiles, setPhotoFiles] = useState([]) // [{file, previewUrl}]
  const [validationError, setValidationError] = useState(null)

  useEffect(() => {
    fetchMySubmissions()
    const interval = setInterval(fetchMySubmissions, POLL_MS)
    return () => clearInterval(interval)
  }, [fetchMySubmissions])

  function handlePhotoSelect(e) {
    const files = Array.from(e.target.files || [])
    setPhotoFiles((prev) => [...prev, ...files.map((file) => ({ file, previewUrl: URL.createObjectURL(file) }))])
    e.target.value = '' // allow re-selecting the same file after removal
  }

  function removePhoto(index) {
    setPhotoFiles((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl)
      return prev.filter((_, i) => i !== index)
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setValidationError(null)

    if (!name.trim()) {
      setValidationError('Place name is required')
      return
    }
    if (!location) {
      setValidationError('Select this place’s location on the map')
      return
    }
    if (!description.trim()) {
      setValidationError('Tell us what makes it worth visiting')
      return
    }
    if (!state.trim()) {
      setValidationError('Enter the state this place is in')
      return
    }

    let photoUrls = []
    if (photoFiles.length > 0) {
      try {
        photoUrls = await uploadCommunityPhotos(photoFiles.map((p) => p.file))
      } catch {
        return // uploadCommunityPhotos already set communityError
      }
    }

    const ok = await submitCommunityPlace({ name: name.trim(), lat: location.lat, lng: location.lng, description: description.trim(), photos: photoUrls, state: state.trim() })
    if (ok) fetchMySubmissions() // don't wait up to 15s for the poll to pick up the one just sent
  }

  const submission = communityResult?.success ? communityResult.submission : null
  const isBusy = isUploadingPhotos || isSubmittingPlace

  return (
    <div className="mx-auto max-w-md">
      <PageHeader
        icon={MapPinned}
        title="Suggest a place"
        description="Know somewhere worth visiting that isn't on the map yet? Tell us about it. You'll need at least one verified visit anywhere on the platform to submit -- this keeps suggestions coming from real travellers."
      />

      <Link to="/forum" className="mb-4 flex items-center gap-1.5 text-sm font-medium text-pressure hover:underline">
        <Users size={15} aria-hidden="true" /> See what other travellers have suggested
      </Link>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Place name">
            <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Hidden waterfall" className={inputClass} />
          </FormField>

          <FormField label="Location">
            <LocationPickerMap value={location} onChange={setLocation} />
          </FormField>

          <FormField label="State" hint="Helps other travellers browsing the Community Forum find this">
            <input
              value={state}
              onChange={(e) => setState(e.target.value)}
              required
              placeholder="e.g. Himachal Pradesh"
              className={inputClass}
            />
          </FormField>

          <FormField label="What makes it worth visiting?">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} required className={inputClass} />
          </FormField>

          <FormField label="Photos" optional>
            <div className="space-y-2">
              {photoFiles.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {photoFiles.map((p, i) => (
                    <div key={p.previewUrl} className="relative h-16 w-16 overflow-hidden rounded-lg border border-paper-dim">
                      <img src={p.previewUrl} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(i)}
                        className="absolute right-0.5 top-0.5 rounded-full bg-ink/70 p-0.5 text-paper"
                        aria-label="Remove photo"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className="flex w-fit cursor-pointer items-center gap-1.5 rounded-lg border border-paper-dim bg-paper px-3 py-2 text-xs font-medium text-ink/70 transition hover:border-ink/40">
                <Upload size={14} aria-hidden="true" />
                Upload photos
                <input type="file" accept="image/*" multiple onChange={handlePhotoSelect} className="hidden" />
              </label>
            </div>
          </FormField>

          {(validationError || communityError) && <Alert tone="error">{validationError || communityError}</Alert>}

          <Button type="submit" variant="primary" fullWidth loading={isBusy}>
            {isUploadingPhotos ? 'Uploading photos…' : 'Submit suggestion'}
          </Button>
        </form>
      </Card>

      {submission && (
        <div className="mt-4">
          <Alert tone="success" action={<Badge tone={submissionStatus(submission.status).tone}>{submissionStatus(submission.status).label}</Badge>}>
            Submitted. An authority will review it before it appears on the map.
          </Alert>
        </div>
      )}

      {mySubmissions.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-ink">Your submissions</h2>
          <div className="space-y-2">
            {mySubmissions.map((s) => {
              const status = submissionStatus(s.status)
              return (
                <Card key={s._id} padding="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-ink">{s.name}</p>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-ash">Submitted {new Date(s.createdAt).toLocaleDateString()}</p>
                  {s.rejectionReason && <p className="mt-1 text-xs text-pressure">{s.rejectionReason}</p>}
                </Card>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
