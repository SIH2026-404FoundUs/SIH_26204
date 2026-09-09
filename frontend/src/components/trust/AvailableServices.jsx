import { useEffect, useState } from 'react'
import { Car, Compass as GuideIcon, Home, Wrench } from 'lucide-react'
import { useTrustStore } from '../../store/useTrustStore'
import { verificationTier } from '../../lib/labels'
import PageHeader from '../ui/PageHeader'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import Alert from '../ui/Alert'
import EmptyState from '../ui/EmptyState'
import LoadingState from '../ui/LoadingState'
import FormField from '../ui/FormField'
import DestinationSelect from '../ui/DestinationSelect'

// Traveller-facing "Available Services" (More -> Available Services): the
// same GET /api/v1/businesses/search + growth-ranking this project already
// has (Businesses.jsx, the operator/authority-facing "Local businesses"
// page) -- reused verbatim, just scoped down to the three traveller-relevant
// categories and given a traveller-appropriate label, per the role-based
// nav revision. No new API, no new backend model: "Available Services" is a
// UI label over the existing `type` enum on the Business model.
const SERVICE_TABS = [
  { type: 'driver', label: 'Drivers', icon: Car },
  { type: 'guide', label: 'Guides', icon: GuideIcon },
  { type: 'guesthouse', label: 'Guesthouses', icon: Home },
]

export default function AvailableServices() {
  const { businesses, isLoadingBusinesses, searchBusinesses, businessError } = useTrustStore()
  const [destId, setDestId] = useState('manali')
  const [activeType, setActiveType] = useState('driver')

  useEffect(() => {
    searchBusinesses({ destId, type: activeType })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destId, activeType])

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        icon={Wrench}
        title="Available services"
        description="Drivers, guides, and guesthouses onboarded directly through the platform for your destination."
      />

      <div className="mb-4 max-w-xs">
        <FormField label="Destination">
          <DestinationSelect value={destId} onChange={setDestId} />
        </FormField>
      </div>

      <div className="mb-6 flex gap-1.5 rounded-lg border border-paper-dim bg-white p-1">
        {SERVICE_TABS.map((tab) => (
          <button
            key={tab.type}
            type="button"
            onClick={() => setActiveType(tab.type)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition ${
              activeType === tab.type ? 'bg-ink text-paper' : 'text-ink/70 hover:bg-ink/5'
            }`}
          >
            <tab.icon size={15} aria-hidden="true" />
            {tab.label}
          </button>
        ))}
      </div>

      {businessError && <div className="mb-4"><Alert tone="error">{businessError}</Alert></div>}

      {isLoadingBusinesses ? (
        <LoadingState label="Finding available services…" />
      ) : businesses.length === 0 ? (
        <EmptyState title="None onboarded here yet" description={`No ${SERVICE_TABS.find((t) => t.type === activeType)?.label.toLowerCase()} for this destination yet.`} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {businesses.map((b) => {
            const tier = verificationTier(b.verificationTier)
            return (
              <Card key={b._id} padding="p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-ink">{b.name}</span>
                  <Badge tone={tier.tone}>{tier.label}</Badge>
                </div>
                {b.priceRangeINR && <p className="mt-2 text-xs text-ash">₹{b.priceRangeINR.min}–{b.priceRangeINR.max} / night</p>}
                {b.languages?.length > 0 && <p className="mt-1 text-xs text-ash">Speaks {b.languages.join(', ')}</p>}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
