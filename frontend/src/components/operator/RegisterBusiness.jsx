import { useEffect, useState } from 'react'
import { Store, Check, Mic, MessageCircle, Globe } from 'lucide-react'
import { useOperatorStore } from '../../store/useOperatorStore'
import PageHeader from '../ui/PageHeader'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Alert from '../ui/Alert'
import FormField, { inputClass } from '../ui/FormField'
import DestinationSelect from '../ui/DestinationSelect'

const rawWhatsappNumber = import.meta.env.VITE_WHATSAPP_ONBOARDING_NUMBER || ''
const cleanWhatsappNumber = rawWhatsappNumber.replace(/\D/g, '')
const PREFILLED_MESSAGE = 'Hi, I want to register my business'
const whatsappUrl = cleanWhatsappNumber
  ? `https://wa.me/${cleanWhatsappNumber}?text=${encodeURIComponent(PREFILLED_MESSAGE)}`
  : null

const BUSINESS_TYPES = [
  { value: 'hotel', label: 'Hotel' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'homestay', label: 'Homestay' },
  { value: 'guesthouse', label: 'Guesthouse' },
  { value: 'guide', label: 'Guide' },
  { value: 'driver', label: 'Driver' },
  { value: 'cook', label: 'Cook' },
]

const EMPTY_FORM = {
  name: '', type: 'hotel', destId: '', capacity: '', ownerPhone: '',
  minPriceINR: '', maxPriceINR: '', languages: '', amenities: '', meals: '', nearestLandmark: '', websiteUrl: '',
}

// Registers a business directly (POST /v1/businesses) -- an alternative
// entry point to the same Business collection the WhatsApp-onboarding
// pipeline already writes to, so a registered business shows up wherever
// businesses already do (Available Services, Businesses, destination
// suggestions) through the exact same search API, nothing separate.
export default function RegisterBusiness() {
  const { myBusinesses, isLoadingBusinesses, businessesError, isRegistering, registerError, fetchMyBusinesses, registerBusiness } = useOperatorStore()
  const [form, setForm] = useState(EMPTY_FORM)
  const [validationError, setValidationError] = useState(null)
  const [justRegistered, setJustRegistered] = useState(null)

  useEffect(() => { fetchMyBusinesses() }, [fetchMyBusinesses])

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setValidationError(null)
    setJustRegistered(null)

    if (!form.name.trim()) return setValidationError('Business name is required')
    if (!form.destId) return setValidationError('Destination is required')
    if (!form.capacity || Number(form.capacity) <= 0) return setValidationError('Max capacity is required')
    if (!form.ownerPhone.trim()) return setValidationError('Owner phone is required')

    const payload = {
      name: form.name.trim(),
      type: form.type,
      destId: form.destId,
      capacity: Number(form.capacity),
      ownerPhone: form.ownerPhone.trim(),
      languages: form.languages.split(',').map((l) => l.trim()).filter(Boolean),
      amenities: form.amenities.split(',').map((a) => a.trim()).filter(Boolean),
      meals: form.meals.split(',').map((m) => m.trim()).filter(Boolean),
      nearestLandmark: form.nearestLandmark.trim() || undefined,
      websiteUrl: form.websiteUrl.trim() || undefined,
    }
    if (form.minPriceINR || form.maxPriceINR) {
      payload.priceRangeINR = {
        min: form.minPriceINR ? Number(form.minPriceINR) : undefined,
        max: form.maxPriceINR ? Number(form.maxPriceINR) : undefined,
      }
    }

    const created = await registerBusiness(payload)
    if (created) {
      setJustRegistered(created)
      setForm(EMPTY_FORM)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        icon={Store}
        title="Register your business"
        description="Hotels, restaurants, homestays, guesthouses, guides, drivers, cooks -- listed directly, so travellers can find and book you the same way they find every other business on the platform."
      />

      <Card className="mb-6 border-relief/30 bg-relief/5">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-relief/15 text-relief">
              <Mic size={18} aria-hidden="true" />
            </span>
            <h2 className="text-sm font-semibold text-ink">Register via WhatsApp Voice</h2>
          </div>
          <p className="text-sm text-ash">
            Skip filling out the form manually. Tourism providers can register their business simply by sending a voice message on WhatsApp in their preferred language. Our AI assistant will automatically extract your business details, capacity, pricing, and amenities.
          </p>
        </div>

        <div className="mt-4 flex flex-col items-start gap-2.5 sm:flex-row sm:items-center">
          {whatsappUrl ? (
            <Button
              variant="relief"
              icon={MessageCircle}
              onClick={() => window.open(whatsappUrl, '_blank', 'noopener,noreferrer')}
            >
              Start on WhatsApp
            </Button>
          ) : (
            <Button variant="relief" disabled icon={MessageCircle}>
              Start on WhatsApp
            </Button>
          )}

          {!whatsappUrl && (
            <p className="text-xs text-pressure font-medium">
              WhatsApp onboarding is temporarily unavailable: VITE_WHATSAPP_ONBOARDING_NUMBER is not configured.
            </p>
          )}
        </div>
      </Card>

      <div className="relative mb-6 flex items-center justify-center">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-paper-dim" />
        </div>
        <div className="relative bg-paper px-3 text-xs font-semibold uppercase tracking-wider text-ash">
          Or fill the registration form manually
        </div>
      </div>

      <Card className="mb-6">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Business name">
            <input value={form.name} onChange={set('name')} required placeholder="e.g. Grand View Hotel" className={inputClass} />
          </FormField>
          <FormField label="Type">
            <select value={form.type} onChange={set('type')} className={inputClass}>
              {BUSINESS_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </FormField>
          <FormField label="Destination">
            <DestinationSelect value={form.destId} onChange={(v) => setForm((p) => ({ ...p, destId: v }))} required />
          </FormField>
          <FormField label="Max capacity" hint="Rooms, tables, or seats -- whatever this business type books out">
            <input type="number" min="1" value={form.capacity} onChange={set('capacity')} required placeholder="e.g. 40" className={inputClass} />
          </FormField>
          <FormField label="Owner phone">
            <input value={form.ownerPhone} onChange={set('ownerPhone')} required placeholder="+91XXXXXXXXXX" className={inputClass} />
          </FormField>
          <FormField label="Nearest landmark" optional>
            <input value={form.nearestLandmark} onChange={set('nearestLandmark')} className={inputClass} />
          </FormField>
          <FormField label="Website or Instagram link" optional hint="Shown to help promote your business">
            <input value={form.websiteUrl} onChange={set('websiteUrl')} placeholder="e.g. myhotel.com" className={inputClass} />
          </FormField>
          <FormField label="Languages spoken" optional hint="Comma-separated, e.g. en, hi">
            <input value={form.languages} onChange={set('languages')} className={inputClass} />
          </FormField>
          <FormField label="Amenities" optional hint="Comma-separated">
            <input value={form.amenities} onChange={set('amenities')} className={inputClass} />
          </FormField>
          <FormField label="Meals offered" optional hint="Comma-separated">
            <input value={form.meals} onChange={set('meals')} className={inputClass} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Min price (₹)" optional>
              <input type="number" min="0" value={form.minPriceINR} onChange={set('minPriceINR')} className={inputClass} />
            </FormField>
            <FormField label="Max price (₹)" optional>
              <input type="number" min="0" value={form.maxPriceINR} onChange={set('maxPriceINR')} className={inputClass} />
            </FormField>
          </div>

          {(validationError || registerError) && (
            <div className="sm:col-span-2"><Alert tone="error">{validationError || registerError}</Alert></div>
          )}

          <div className="sm:col-span-2">
            <Button type="submit" variant="primary" fullWidth loading={isRegistering}>Register business</Button>
          </div>
        </form>
      </Card>

      {justRegistered && (
        <div className="mb-6">
          <Alert tone="success">
            <p className="font-medium">{justRegistered.name} registered.</p>
            <p className="mt-0.5 text-relief">It's now discoverable to travellers searching {justRegistered.destId}.</p>
          </Alert>
        </div>
      )}

      <h2 className="mb-3 text-sm font-semibold text-ink">Your businesses</h2>
      {businessesError && <Alert tone="error">{businessesError}</Alert>}
      {isLoadingBusinesses ? (
        <p className="text-sm text-ash">Loading…</p>
      ) : myBusinesses.length === 0 ? (
        <p className="text-sm text-ink/50">Nothing registered yet.</p>
      ) : (
        <div className="space-y-2">
          {myBusinesses.map((b) => (
            <Card key={b._id} padding="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-ink">{b.name}</p>
                  <p className="text-xs text-ash">{b.destId} · capacity {b.capacity ?? '—'}</p>
                  {b.websiteUrl && (
                    <a href={b.websiteUrl} target="_blank" rel="noopener noreferrer" className="mt-1 flex items-center gap-1 text-xs font-medium text-relief hover:underline">
                      <Globe size={11} aria-hidden="true" /> {b.websiteUrl.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                </div>
                <Badge tone="success" icon={Check}>{b.type}</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
