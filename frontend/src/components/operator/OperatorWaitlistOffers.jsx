import { useEffect, useState } from 'react'
import { Tag, Users, CalendarCheck, RotateCw } from 'lucide-react'
import { useOperatorStore } from '../../store/useOperatorStore'
import { bookingStatus } from '../../lib/labels'
import PageHeader from '../ui/PageHeader'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Alert from '../ui/Alert'
import EmptyState from '../ui/EmptyState'
import LoadingState from '../ui/LoadingState'
import FormField, { inputClass } from '../ui/FormField'

const OFFER_FORM_DEFAULT = { date: '', originalPrice: '', discountPct: '20', durationMinutes: '15' }

// Polled, not fetched once: an operator watching this page for new demand
// needs the waitlist (and now bookings) to actually update while it's open,
// not just at the moment of navigating here. 15s matches "real-time enough
// to act on" without hammering the API -- same category of interval as
// OperatorVerifyVisit's 10s code poll, just for demand data instead of a
// rotating auth code.
const POLL_MS = 15_000

export default function OperatorWaitlistOffers() {
  const {
    myBusinesses, isLoadingBusinesses, fetchMyBusinesses,
    businessWaitlist, isLoadingWaitlist, waitlistError, fetchBusinessWaitlist,
    businessBookings, isLoadingBookings, bookingsError, fetchBusinessBookings,
    isCreatingOffer, offerError, lastOffer, lastOfferNotifiedCount, createOffer,
  } = useOperatorStore()

  const [selectedBusinessId, setSelectedBusinessId] = useState('')
  const [offerForm, setOfferForm] = useState(OFFER_FORM_DEFAULT)
  const [validationError, setValidationError] = useState(null)
  const [lastSyncedAt, setLastSyncedAt] = useState(null)

  useEffect(() => { fetchMyBusinesses() }, [fetchMyBusinesses])

  // No default-selection effect -- derived directly from render so there's
  // nothing to set-state-cascade: once the operator's businesses load, the
  // first one is simply what "selected" resolves to until they pick another.
  const effectiveBusinessId = selectedBusinessId || myBusinesses[0]?._id || ''

  useEffect(() => {
    if (!effectiveBusinessId) return

    const sync = (silent) => {
      Promise.all([
        fetchBusinessWaitlist(effectiveBusinessId, { silent }),
        fetchBusinessBookings(effectiveBusinessId, { silent }),
      ]).then(() => setLastSyncedAt(new Date()))
    }

    sync(false) // first load shows the normal loading states
    const interval = setInterval(() => sync(true), POLL_MS) // subsequent polls are silent
    return () => clearInterval(interval)
  }, [effectiveBusinessId, fetchBusinessWaitlist, fetchBusinessBookings])

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

  function handleManualRefresh() {
    if (!effectiveBusinessId) return
    Promise.all([
      fetchBusinessWaitlist(effectiveBusinessId),
      fetchBusinessBookings(effectiveBusinessId, { silent: true }),
    ]).then(() => setLastSyncedAt(new Date()))
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader icon={Tag} title="Waitlist & offers" description="See who's waiting for an opening and who's booked, and open a flash offer that notifies the waitlist automatically." />

      {isLoadingBusinesses ? (
        <LoadingState label="Loading your businesses…" />
      ) : myBusinesses.length === 0 ? (
        <EmptyState icon={Tag} title="Register a business first" description="Once you've registered a business, its waitlist, bookings, and offers show up here." />
      ) : (
        <>
          <div className="mb-6 flex items-end gap-3">
            <div className="flex-1">
              <FormField label="Business">
                <select value={effectiveBusinessId} onChange={(e) => setSelectedBusinessId(e.target.value)} className={inputClass}>
                  {myBusinesses.map((b) => <option key={b._id} value={b._id}>{b.name} · {b.destId}</option>)}
                </select>
              </FormField>
            </div>
            <Button type="button" variant="outline" size="sm" icon={RotateCw} onClick={handleManualRefresh}>
              Refresh
            </Button>
          </div>
          {lastSyncedAt && (
            <p className="mb-4 -mt-3 text-xs text-ash">
              Live -- updates automatically every 15s. Last synced {lastSyncedAt.toLocaleTimeString()}.
            </p>
          )}

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

          <div className="mb-3 flex items-center gap-2">
            <CalendarCheck size={16} className="text-ink/60" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-ink">Bookings</h2>
          </div>
          {bookingsError && <Alert tone="error">{bookingsError}</Alert>}
          {isLoadingBookings ? (
            <LoadingState label="Loading bookings…" />
          ) : businessBookings.length === 0 ? (
            <p className="mb-6 text-sm text-ink/50">No bookings yet.</p>
          ) : (
            <div className="mb-6 space-y-2">
              {businessBookings.map((b) => {
                const status = bookingStatus(b.status)
                return (
                  <Card key={b._id} padding="p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-ink">{new Date(b.date).toLocaleDateString()}</p>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-ash">
                      {b.travellers} traveller{b.travellers === 1 ? '' : 's'}
                      {b.notes ? ` · ${b.notes}` : ''}
                    </p>
                  </Card>
                )
              })}
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
