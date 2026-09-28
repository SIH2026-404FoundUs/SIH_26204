import { useEffect, useState } from 'react'
import { Users, Store, Phone, Languages, Briefcase } from 'lucide-react'
import { useOperatorStore } from '../../store/useOperatorStore'
import PostGig from './PostGig'
import PageHeader from '../ui/PageHeader'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Alert from '../ui/Alert'
import EmptyState from '../ui/EmptyState'
import LoadingState from '../ui/LoadingState'
import FormField from '../ui/FormField'
import DestinationSelect from '../ui/DestinationSelect'

const PAGE_TABS = [
  { key: 'businesses', label: 'Local Businesses', icon: Store },
  { key: 'post-gig', label: 'Post a Gig', icon: Briefcase },
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

// Hiring on this platform happens through the same voice-onboarding pipeline
// a business itself uses to list -- a worker (cook, driver, guide, or any
// other travel-industry role) describes themselves in a WhatsApp voice
// note and gets listed the same way. There's no separate "hiring" system.
// This page browses workers already listed that way (Local Businesses --
// same GET /v1/businesses/search Available Services uses, filtered to
// worker types) with a "click to hire" contact reveal, and posts short-term
// gigs (Post a Gig). Onboarding a new worker happens through the real
// WhatsApp number/voice pipeline itself, not a form on this page.
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
    <div className="mx-auto max-w-3xl">
      <PageHeader
        icon={Users}
        title="Hire people"
        description="Browse workers already onboarded, or post a short-term gig that notifies matching workers immediately."
      />

      {isLoadingBusinesses ? (
        <LoadingState label="Loading your businesses…" />
      ) : myBusinesses.length === 0 ? (
        <EmptyState icon={Store} title="Register a business first" description="Once you've registered a business, you can browse and hire local workers." />
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

          {activeTab === 'businesses' && <LocalBusinessesTab />}
          {activeTab === 'post-gig' && <PostGig />}
        </>
      )}
    </div>
  )
}
