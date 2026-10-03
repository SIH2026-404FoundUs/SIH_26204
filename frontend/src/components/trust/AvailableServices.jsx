import { useEffect, useState } from 'react'
import { Car, Compass as GuideIcon, Home, Wrench, CalendarCheck } from 'lucide-react'
import { useTrustStore } from '../../store/useTrustStore'
import { verificationTier, bookingStatus } from '../../lib/labels'
import PageHeader from '../ui/PageHeader'
import TabBar from '../ui/TabBar'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Alert from '../ui/Alert'
import EmptyState from '../ui/EmptyState'
import LoadingState from '../ui/LoadingState'
import FormField, { inputClass } from '../ui/FormField'
import DestinationSelect from '../ui/DestinationSelect'
import Modal from '../ui/Modal'

// Traveller-facing "Available Services" (More -> Available Services): the
// same GET /api/v1/businesses/search + growth-ranking this project already
// has (Businesses.jsx, the operator/authority-facing "Local businesses"
// page) -- reused verbatim, just scoped down to the three traveller-relevant
// categories and given a traveller-appropriate label, per the role-based
// nav revision. No new API, no new backend model: "Available Services" is a
// UI label over the existing `type` enum on the Business model.
//
// Booking (POST /v1/bookings, new): confirmed immediately only when a real
// operator-declared availability row exists to claim a unit from -- true for
// almost no business today, since nothing in this codebase writes that yet
// (OperatorConsole.jsx's own "coming soon"). Otherwise it's created as a
// real, pending request. Never a fabricated instant "Booked!".
const SERVICE_TABS = [
  { type: 'driver', label: 'Drivers', icon: Car },
  { type: 'guide', label: 'Guides', icon: GuideIcon },
  { type: 'guesthouse', label: 'Guesthouses', icon: Home },
]

export default function AvailableServices() {
  const {
    businesses, isLoadingBusinesses, searchBusinesses, businessError,
    myBookings, fetchMyBookings, createBooking, isBooking, bookingError,
  } = useTrustStore()
  const [destId, setDestId] = useState('manali')
  const [activeType, setActiveType] = useState('driver')
  const [bookingBusiness, setBookingBusiness] = useState(null) // the business currently open in the modal
  const [form, setForm] = useState({ date: '', travellers: 1, notes: '' })
  const [validationError, setValidationError] = useState(null)

  useEffect(() => {
    searchBusinesses({ destId, type: activeType })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destId, activeType])

  useEffect(() => { fetchMyBookings() }, [fetchMyBookings])

  function openBooking(business) {
    setBookingBusiness(business)
    setForm({ date: '', travellers: 1, notes: '' })
    setValidationError(null)
  }

  async function handleBook(e) {
    e.preventDefault()
    setValidationError(null)
    if (!form.date) return setValidationError('Choose a date')
    const result = await createBooking({
      businessId: bookingBusiness._id,
      date: form.date,
      travellers: Number(form.travellers) || 1,
      notes: form.notes.trim() || undefined,
    })
    if (result) setBookingBusiness(null)
  }

  const bookingsByBusiness = myBookings.reduce((map, b) => {
    if (!map[b.businessId]) map[b.businessId] = []
    map[b.businessId].push(b)
    return map
  }, {})

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

      <TabBar tabs={SERVICE_TABS} active={activeType} onChange={setActiveType} className="mb-6 flex" />

      {businessError && <div className="mb-4"><Alert tone="error">{businessError}</Alert></div>}

      {isLoadingBusinesses ? (
        <LoadingState label="Finding available services…" />
      ) : businesses.length === 0 ? (
        <EmptyState title="None onboarded here yet" description={`No ${SERVICE_TABS.find((t) => t.type === activeType)?.label.toLowerCase()} for this destination yet.`} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {businesses.map((b) => {
            const tier = verificationTier(b.verificationTier)
            const existingBookings = bookingsByBusiness[b._id] || []
            return (
              <Card key={b._id} padding="p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-ink">{b.name}</span>
                  <Badge tone={tier.tone}>{tier.label}</Badge>
                </div>
                {b.priceRangeINR && <p className="mt-2 text-xs text-ash">₹{b.priceRangeINR.min}–{b.priceRangeINR.max} / night</p>}
                {b.languages?.length > 0 && <p className="mt-1 text-xs text-ash">Speaks {b.languages.join(', ')}</p>}

                {existingBookings.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {existingBookings.map((bk) => {
                      const status = bookingStatus(bk.status)
                      return (
                        <Badge key={bk._id} tone={status.tone}>
                          {new Date(bk.date).toLocaleDateString()} · {status.label}
                        </Badge>
                      )
                    })}
                  </div>
                )}

                <Button variant="primary" size="sm" icon={CalendarCheck} className="mt-3" onClick={() => openBooking(b)}>
                  Book
                </Button>
              </Card>
            )
          })}
        </div>
      )}

      <Modal open={!!bookingBusiness} onClose={() => setBookingBusiness(null)} title={bookingBusiness ? `Book ${bookingBusiness.name}` : ''}>
        <form onSubmit={handleBook} className="mt-3 space-y-4">
          <FormField label="Date">
            <input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} required className={inputClass} />
          </FormField>
          <FormField label="Travellers">
            <input type="number" min="1" value={form.travellers} onChange={(e) => setForm((p) => ({ ...p, travellers: e.target.value }))} className={inputClass} />
          </FormField>
          <FormField label="Notes" optional>
            <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={2} className={inputClass} />
          </FormField>

          {(validationError || bookingError) && <Alert tone="error">{validationError || bookingError}</Alert>}

          <div className="flex gap-2">
            <Button type="submit" variant="primary" fullWidth loading={isBooking}>Confirm booking</Button>
            <Button type="button" variant="secondary" onClick={() => setBookingBusiness(null)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
