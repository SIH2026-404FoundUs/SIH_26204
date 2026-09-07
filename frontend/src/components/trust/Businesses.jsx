import { useState } from 'react'
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

const TYPES = ['', 'homestay', 'guesthouse', 'guide', 'driver', 'cook']

/** Local businesses for a destination, ranked to favor newly onboarded and verified operators. */
export default function Businesses() {
  const { businesses, isLoadingBusinesses, searchBusinesses, businessError } = useTrustStore()
  const [destId, setDestId] = useState('manali')
  const [type, setType] = useState('')

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader icon={Store} title="Local businesses" description="Homestays, guides, drivers, and cooks onboarded directly through the platform." />

      <form onSubmit={(e) => { e.preventDefault(); searchBusinesses({ destId, type }) }} className="mb-6 flex items-end gap-3">
        <div className="flex-1"><FormField label="Destination"><DestinationSelect value={destId} onChange={setDestId} /></FormField></div>
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
                  <span className="text-sm font-semibold text-slate-800">{b.name}</span>
                  <Badge tone="neutral">{b.type}</Badge>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <Badge tone={tier.tone}>{tier.label}</Badge>
                  {b.onboardedVia === 'whatsapp' && <span className="text-xs text-slate-400">Locally onboarded</span>}
                </div>
                {b.priceRangeINR && <p className="mt-2 text-xs text-slate-400">₹{b.priceRangeINR.min}–{b.priceRangeINR.max} / night</p>}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
