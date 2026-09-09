import { useEffect, useState } from 'react'
import { Tag, Users } from 'lucide-react'
import { useOperatorStore } from '../../store/useOperatorStore'
import PageHeader from '../ui/PageHeader'
import Card from '../ui/Card'
import Button from '../ui/Button'
import Alert from '../ui/Alert'
import EmptyState from '../ui/EmptyState'
import LoadingState from '../ui/LoadingState'
import FormField, { inputClass } from '../ui/FormField'

const OFFER_FORM_DEFAULT = { date: '', originalPrice: '', discountPct: '20', durationMinutes: '15' }

// SmartWaitlist, operator side: who's waiting for an opening at this
// business's destination (GET /v1/waitlist/business/:id -- same Waitlist
// collection travellers join from Offers & Waitlist, filtered server-side
// to businesses this operator owns), plus creating the flash offer
// (POST /v1/offers, unchanged) that fans out to them automatically.
export default function OperatorWaitlistOffers() {
  const {
    myBusinesses, isLoadingBusinesses, fetchMyBusinesses,
    businessWaitlist, isLoadingWaitlist, waitlistError, fetchBusinessWaitlist,
    isCreatingOffer, offerError, lastOffer, lastOfferNotifiedCount, createOffer,
  } = useOperatorStore()

  const [selectedBusinessId, setSelectedBusinessId] = useState('')
  const [offerForm, setOfferForm] = useState(OFFER_FORM_DEFAULT)
  const [validationError, setValidationError] = useState(null)

  useEffect(() => { fetchMyBusinesses() }, [fetchMyBusinesses])

  // No default-selection effect -- derived directly from render so there's
  // nothing to set-state-cascade: once the traveller's businesses load, the
  // first one is simply what "selected" resolves to until they pick another.
  const effectiveBusinessId = selectedBusinessId || myBusinesses[0]?._id || ''

  useEffect(() => {
    if (effectiveBusinessId) fetchBusinessWaitlist(effectiveBusinessId)
  }, [effectiveBusinessId, fetchBusinessWaitlist])

  const selectedBusiness = myBusinesses.find((b) => b._id === effectiveBusinessId)

  async function handleCreateOffer(e) {
    e.preventDefault()
    setValidationError(null)
    if (!selectedBusiness) return
    if (!offerForm.date) return setValidationError('Date is required')
    if (!offerForm.originalPrice || Number(offerForm.originalPrice) <= 0) return setValidationError('Original price is required')

    const ok = await createOffer({
      businessId: selectedBusiness._id,
      destId: selectedBusiness.destId,
      date: offerForm.date,
      originalPrice: Number(offerForm.originalPrice),
      discountPct: Number(offerForm.discountPct) || 0,
      durationMinutes: Number(offerForm.durationMinutes) || 15,
    })
    if (ok) setOfferForm(OFFER_FORM_DEFAULT)
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader icon={Tag} title="Waitlist & offers" description="See who's waiting for an opening, and open a flash offer that notifies them automatically." />

      {isLoadingBusinesses ? (
        <LoadingState label="Loading your businesses…" />
      ) : myBusinesses.length === 0 ? (
        <EmptyState icon={Tag} title="Register a business first" description="Once you've registered a business, its waitlist and offers show up here." />
      ) : (
        <>
          <FormField label="Business">
            <select value={effectiveBusinessId} onChange={(e) => setSelectedBusinessId(e.target.value)} className={`${inputClass} mb-6`}>
              {myBusinesses.map((b) => <option key={b._id} value={b._id}>{b.name} · {b.destId}</option>)}
            </select>
          </FormField>

          <div className="mb-3 flex items-center gap-2">
            <Users size={16} className="text-ink/60" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-ink">Waiting for {selectedBusiness?.destId}</h2>
          </div>
          {waitlistError && <Alert tone="error">{waitlistError}</Alert>}
          {isLoadingWaitlist ? (
            <LoadingState label="Loading waitlist…" />
          ) : businessWaitlist.length === 0 ? (
            <p className="mb-6 text-sm text-ink/50">No one is waiting right now.</p>
          ) : (
            <div className="mb-6 space-y-2">
              {businessWaitlist.map((w) => (
                <Card key={w._id} padding="p-3">
                  <p className="text-sm text-ink">
                    {new Date(w.window.from).toLocaleDateString()} – {new Date(w.window.to).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-ash">Up to ₹{w.criteria.maxPriceINR} · {w.criteria.travellers} traveller{w.criteria.travellers === 1 ? '' : 's'}</p>
                </Card>
              ))}
            </div>
          )}

          <h2 className="mb-3 text-sm font-semibold text-ink">Open a flash offer</h2>
          <Card>
            <form onSubmit={handleCreateOffer} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Date">
                <input type="date" value={offerForm.date} onChange={(e) => setOfferForm((p) => ({ ...p, date: e.target.value }))} required className={inputClass} />
              </FormField>
              <FormField label="Original price (₹)">
                <input type="number" min="0" value={offerForm.originalPrice} onChange={(e) => setOfferForm((p) => ({ ...p, originalPrice: e.target.value }))} required className={inputClass} />
              </FormField>
              <FormField label="Discount %">
                <input type="number" min="0" max="100" value={offerForm.discountPct} onChange={(e) => setOfferForm((p) => ({ ...p, discountPct: e.target.value }))} className={inputClass} />
              </FormField>
              <FormField label="Open for (minutes)">
                <input type="number" min="1" value={offerForm.durationMinutes} onChange={(e) => setOfferForm((p) => ({ ...p, durationMinutes: e.target.value }))} className={inputClass} />
              </FormField>

              {(validationError || offerError) && (
                <div className="sm:col-span-2"><Alert tone="error">{validationError || offerError}</Alert></div>
              )}

              <div className="sm:col-span-2">
                <Button type="submit" variant="primary" fullWidth loading={isCreatingOffer}>Open offer</Button>
              </div>
            </form>
          </Card>

          {lastOffer && (
            <div className="mt-4">
              <Alert tone="success">
                <p className="font-medium">Offer opened -- ₹{lastOffer.effectivePrice} ({lastOffer.discountPct}% off ₹{lastOffer.originalPrice}).</p>
                <p className="mt-0.5 text-relief">
                  Expires {new Date(lastOffer.expiresAt).toLocaleTimeString()} · {lastOfferNotifiedCount} {lastOfferNotifiedCount === 1 ? 'person' : 'people'} on the waitlist notified.
                </p>
              </Alert>
            </div>
          )}
        </>
      )}
    </div>
  )
}
