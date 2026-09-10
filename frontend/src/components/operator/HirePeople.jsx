import { useEffect, useState } from 'react'
import { Users, Store, Mic, Upload, Phone, Languages } from 'lucide-react'
import { useOperatorStore } from '../../store/useOperatorStore'
import PageHeader from '../ui/PageHeader'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Alert from '../ui/Alert'
import EmptyState from '../ui/EmptyState'
import LoadingState from '../ui/LoadingState'
import FormField, { inputClass } from '../ui/FormField'
import DestinationSelect from '../ui/DestinationSelect'

const PAGE_TABS = [
  { key: 'businesses', label: 'Local Businesses', icon: Store },
  { key: 'onboarding', label: 'Onboarding', icon: Mic },
]

const WORKER_TABS = [
  { type: 'driver', label: 'Drivers' },
  { type: 'guide', label: 'Guides' },
  { type: 'cook', label: 'Cooks' },
]

function LocalBusinessesTab() {
  const {
    workers, isLoadingWorkers, workersError, searchWorkers,
    revealedContacts, revealingContactId, contactError, hireContact,
  } = useOperatorStore()

  const [destId, setDestId] = useState('manali')
  const [activeType, setActiveType] = useState('driver')

  useEffect(() => {
    if (destId) searchWorkers({ destId, type: activeType })
  }, [destId, activeType, searchWorkers])

  return (
    <div>
      <FormField label="Destination">
        <DestinationSelect value={destId} onChange={setDestId} />
      </FormField>

      <div className="my-4 flex gap-1.5 rounded-lg border border-paper-dim bg-white p-1">
        {WORKER_TABS.map((tab) => (
          <button
            key={tab.type}
            type="button"
            onClick={() => setActiveType(tab.type)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition ${
              activeType === tab.type ? 'bg-ink text-paper' : 'text-ink/70 hover:bg-ink/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {workersError && <Alert tone="error">{workersError}</Alert>}
      {contactError && <Alert tone="error">{contactError}</Alert>}

      {isLoadingWorkers ? (
        <LoadingState label="Loading…" />
      ) : workers.length === 0 ? (
        <EmptyState icon={Users} title="None onboarded here yet" description={`No ${WORKER_TABS.find((t) => t.type === activeType)?.label.toLowerCase()} for this destination yet.`} />
      ) : (
        <div className="space-y-2">
          {workers.map((w) => {
            const contact = revealedContacts[w._id]
            return (
              <Card key={w._id} padding="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-ink">{w.name}</p>
                    {w.languages?.length > 0 && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-ash">
                        <Languages size={12} aria-hidden="true" /> {w.languages.join(', ')}
                      </p>
                    )}
                  </div>
                  <Badge tone={w.verificationTier === 'visit-verified' ? 'success' : 'neutral'}>{w.verificationTier || 'self-declared'}</Badge>
                </div>
                <div className="mt-3">
                  {contact ? (
                    <a href={`tel:${contact.ownerPhone}`} className="flex items-center gap-1.5 text-sm font-medium text-relief">
                      <Phone size={14} aria-hidden="true" /> {contact.ownerPhone}
                    </a>
                  ) : (
                    <Button variant="outline" size="sm" icon={Phone} loading={revealingContactId === w._id} onClick={() => hireContact(w._id)}>
                      Click to hire
                    </Button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function OnboardingTab() {
  const { isSubmittingHire, hireError, hireResult, submitHireOnboarding } = useOperatorStore()
  const [onboardDestId, setOnboardDestId] = useState('')
  const [ownerPhone, setOwnerPhone] = useState('')
  const [audioFile, setAudioFile] = useState(null)
  const [validationError, setValidationError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setValidationError(null)
    if (!audioFile) return setValidationError('Choose a voice recording')
    if (!onboardDestId) return setValidationError('Destination is required')
    if (!ownerPhone.trim()) return setValidationError("The worker's phone number is required")
    await submitHireOnboarding({ audioFile, destId: onboardDestId, ownerPhone: ownerPhone.trim() })
  }

  return (
    <div>
      <div className="mb-4">
        <Alert tone="info">
          This platform's WhatsApp onboarding number isn't set up in this environment yet. In production, a worker sends their voice note straight to it. Until then, use the form below -- it runs through the exact same pipeline (transcription, then extraction into a real listing).
        </Alert>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Worker's phone number">
            <input value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} required placeholder="+91XXXXXXXXXX" className={inputClass} />
          </FormField>
          <FormField label="Destination" hint="Where this person works">
            <DestinationSelect value={onboardDestId} onChange={setOnboardDestId} required />
          </FormField>
          <FormField label="Voice recording" hint="A short note describing their role, skills, and experience (e.g. 'I'm a driver in Manali, 5 years experience, speak Hindi and English')">
            <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-paper-dim bg-paper px-4 py-6 text-sm font-medium text-ink/70 transition hover:border-ink/40">
              <Upload size={16} aria-hidden="true" />
              {audioFile ? audioFile.name : 'Choose an audio file'}
              <input type="file" accept="audio/*" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} className="hidden" />
            </label>
          </FormField>

          {(validationError || hireError) && <Alert tone="error">{validationError || hireError}</Alert>}

          <Button type="submit" variant="primary" fullWidth loading={isSubmittingHire}>Submit for onboarding</Button>
        </form>
      </Card>

      {hireResult && (
        <div className="mt-4">
          <Alert tone={hireResult.applied === false ? 'warning' : hireResult.extraction ? 'success' : 'info'}>
            <p className="font-medium">
              {hireResult.applied === false ? 'Already processed.' : `Onboarding state: ${hireResult.onboardingState || 'unknown'}`}
            </p>
            {hireResult.transcript && <p className="mt-1 text-sm text-ink/70">"{hireResult.transcript}"</p>}
          </Alert>
        </div>
      )}
    </div>
  )
}

// Hiring on this platform happens through the same voice-onboarding pipeline
// a business itself uses to list -- a worker (cook, driver, guide, or any
// other travel-industry role) describes themselves in a WhatsApp voice
// note and gets listed the same way. There's no separate "hiring" system,
// so this page is two real things built on that, as two tabs: browsing
// workers who are already listed (Local Businesses -- same GET
// /v1/businesses/search Available Services uses, filtered to worker types)
// with a "click to hire" contact reveal, and the same onboarding pipeline
// for a worker who isn't listed yet (Onboarding).
//
// Gated on having registered a business first (same useOperatorStore.
// myBusinesses the header's nav already reads) -- an operator with nothing
// registered yet has nothing to hire people *for*. The contact-reveal
// endpoint enforces this server-side too (getBusinessContactController);
// this page-level gate is the corresponding UX, not the only place it's
// checked.
export default function HirePeople() {
  const { myBusinesses, isLoadingBusinesses, fetchMyBusinesses } = useOperatorStore()
  const [activeTab, setActiveTab] = useState('businesses')

  useEffect(() => { fetchMyBusinesses() }, [fetchMyBusinesses])

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        icon={Users}
        title="Hire people"
        description="Workers, cooks, drivers, and guides get listed the same way a business does -- browse who's already onboarded, or onboard someone new."
      />

      {isLoadingBusinesses ? (
        <LoadingState label="Loading your businesses…" />
      ) : myBusinesses.length === 0 ? (
        <EmptyState icon={Store} title="Register a business first" description="Once you've registered a business, you can browse and hire local workers, or onboard someone new." />
      ) : (
        <>
          <div className="mb-6 flex gap-1.5 rounded-lg border border-paper-dim bg-white p-1">
            {PAGE_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition ${
                  activeTab === tab.key ? 'bg-ink text-paper' : 'text-ink/70 hover:bg-ink/5'
                }`}
              >
                <tab.icon size={15} aria-hidden="true" />
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'businesses' ? <LocalBusinessesTab /> : <OnboardingTab />}
        </>
      )}
    </div>
  )
}
