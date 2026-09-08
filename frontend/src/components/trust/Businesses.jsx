import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Store, Search } from 'lucide-react'
import { useTrustStore } from '../../store/useTrustStore'
import { verificationTier } from '../../lib/labels'
import PageHeader from '../ui/PageHeader'
import Card from '../ui/Card'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import Alert from '../ui/Alert'
import EmptyState from '../ui/EmptyState'
import LoadingState from '../ui/LoadingState'
import FormField, { inputClass } from '../ui/FormField'
import DestinationSelect from '../ui/DestinationSelect'

// Staff & guide marketplace (§55 item 11) is not a separate route -- the
// real GET /api/v1/businesses/search already accepts type=guide/driver/cook,
// so it's exposed here as a filter rather than a second, duplicate page.
const TYPES = ['', 'homestay', 'guesthouse', 'guide', 'driver', 'cook']

/** Local businesses for a destination, ranked to favor newly onboarded and verified operators. */
export default function Businesses() {
  const { businesses, isLoadingBusinesses, searchBusinesses, businessError } = useTrustStore()
  const [searchParams] = useSearchParams()
  const [destId, setDestId] = useState(searchParams.get('destId') || 'manali')
  const [type, setType] = useState('')

  // A Destination Detail page can deep-link here with ?destId= -- run the
  // search immediately rather than waiting for the user to press Search.
  useEffect(() => {
    searchBusinesses({ destId, type })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader icon={Store} title="Local businesses" description="Homestays, guides, drivers, and cooks onboarded directly through the platform." />

      <form onSubmit={(e) => { e.preventDefault(); searchBusinesses({ destId, type }) }} className="mb-6 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[10rem]"><FormField label="Destination"><DestinationSelect value={destId} onChange={setDestId} /></FormField></div>
        <div className="w-40">
          <FormField label="Type" optional>
            <select value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
              {TYPES.map((t) => <option key={t} value={t}>{t ? t[0].toUpperCase() + t.slice(1) : 'Any'}</option>)}
            </select>
          </FormField>
        </div>
        <Button type="submit" variant="primary" icon={Search} loading={isLoadingBusinesses}>Search</Button>
      </form>

      {businessError && <div className="mb-4"><Alert tone="error">{businessError}</Alert></div>}

      {isLoadingBusinesses ? (
        <LoadingState label="Finding local businesses…" />
      ) : businesses.length === 0 ? (
        <EmptyState title="No businesses found yet" description="Nobody has onboarded here for this filter yet." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {businesses.map((b) => {
            const tier = verificationTier(b.verificationTier)
            return (
              <Card key={b._id} padding="p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-ink">{b.name}</span>
                  <Badge tone="neutral">{b.type}</Badge>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  {/* Verification tier is a factual statement, never a star
                      rating (§Page9) -- the platform hasn't made a quality
                      judgment, only confirmed what's been verified. */}
                  <Badge tone={tier.tone}>{tier.label}</Badge>
                  {b.onboardedVia === 'whatsapp' && <span className="text-xs text-ash">Locally onboarded</span>}
                </div>
                {b.priceRangeINR && <p className="mt-2 text-xs text-ash">₹{b.priceRangeINR.min}–{b.priceRangeINR.max} / night</p>}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
