import { useEffect, useState } from 'react'
import { CalendarDays, Check, Plus, Wrench } from 'lucide-react'
import PageHeader from '../ui/PageHeader'
import EmptyState from '../ui/EmptyState'
import Card from '../ui/Card'
import LoadingState from '../ui/LoadingState'
import Alert from '../ui/Alert'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import FormField, { inputClass } from '../ui/FormField'
import { useOperatorStore } from '../../store/useOperatorStore'

export default function OperatorConsole() {
  const { myBusinesses, isLoadingBusinesses, fetchMyBusinesses, availability, isLoadingAvailability, availabilityError, isSavingAvailability, fetchAvailability, saveAvailability } = useOperatorStore()
  const [selectedId, setSelectedId] = useState('')
  const [form, setForm] = useState({ date: '', units: '', available: '', pricePerNight: '', discountPct: '0' })
  const [saved, setSaved] = useState(false)
  const businessId = selectedId || myBusinesses[0]?._id || ''
  const business = myBusinesses.find((item) => item._id === businessId)

  useEffect(() => { fetchMyBusinesses() }, [fetchMyBusinesses])
  useEffect(() => { if (businessId) fetchAvailability(businessId) }, [businessId, fetchAvailability])

  async function submit(e) {
    e.preventDefault(); setSaved(false)
    const ok = await saveAvailability(businessId, { ...form, units: Number(form.units), available: form.available === '' ? Number(form.units) : Number(form.available), pricePerNight: form.pricePerNight === '' ? undefined : Number(form.pricePerNight), discountPct: Number(form.discountPct) || 0 })
    if (ok) { setSaved(true); setForm({ date: '', units: '', available: '', pricePerNight: '', discountPct: '0' }) }
  }

  return <div className="mx-auto max-w-3xl">
    <PageHeader icon={Wrench} title="Operator console" description="Declare your open inventory, pricing, and discounts so travellers can make informed booking requests." />
    {isLoadingBusinesses ? <LoadingState label="Loading your businesses..." /> : myBusinesses.length === 0 ? <EmptyState icon={Wrench} title="Register a business first" description="Your availability is attached to a registered listing. Add one from Register business to start accepting booking requests." /> : <>
      <FormField label="Business"><select value={businessId} onChange={(e) => setSelectedId(e.target.value)} className={`${inputClass} mb-6`}>{myBusinesses.map((b) => <option key={b._id} value={b._id}>{b.name} · {b.destId}</option>)}</select></FormField>
      <Card className="mb-6"><div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="font-display text-lg text-ink">Add open dates</h2><p className="mt-1 text-xs text-ash">Declare inventory you can actually honour. Saving the same date updates its declaration.</p></div><CalendarDays size={22} className="text-relief" aria-hidden="true" /></div>
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Date"><input type="date" min={new Date().toISOString().slice(0, 10)} value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} required className={inputClass} /></FormField>
          <FormField label={business?.type === 'restaurant' ? 'Tables total' : 'Units total'}><input type="number" min="0" value={form.units} onChange={(e) => setForm((p) => ({ ...p, units: e.target.value }))} required className={inputClass} /></FormField>
          <FormField label="Bookable now" optional hint="Defaults to total units"><input type="number" min="0" value={form.available} onChange={(e) => setForm((p) => ({ ...p, available: e.target.value }))} className={inputClass} /></FormField>
          <FormField label="Price (INR)" optional><input type="number" min="0" value={form.pricePerNight} onChange={(e) => setForm((p) => ({ ...p, pricePerNight: e.target.value }))} className={inputClass} /></FormField>
          <FormField label="Discount %" optional hint="Maximum 40%"><input type="number" min="0" max="40" value={form.discountPct} onChange={(e) => setForm((p) => ({ ...p, discountPct: e.target.value }))} className={inputClass} /></FormField>
          <div className="flex items-end"><Button type="submit" icon={Plus} loading={isSavingAvailability} fullWidth>Save date</Button></div>
        </form>
      </Card>
      {availabilityError && <div className="mb-4"><Alert tone="error">{availabilityError}</Alert></div>}
      {saved && <div className="mb-4"><Alert tone="success">Availability saved. Travellers will see this date when bookable units are available.</Alert></div>}
      <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold text-ink">Upcoming availability</h2><Badge tone="info">{availability.length} date{availability.length === 1 ? '' : 's'}</Badge></div>
      {isLoadingAvailability ? <LoadingState label="Loading declared dates..." /> : availability.length === 0 ? <EmptyState icon={CalendarDays} title="No dates declared" description="Add an open date above when you know how many units you can honour." /> : <div className="space-y-2">{availability.map((row) => <Card key={row._id} padding="p-4"><div className="flex items-center justify-between gap-4"><div><p className="font-medium text-ink">{new Date(row.date).toLocaleDateString(undefined, { dateStyle: 'medium' })}</p><p className="mt-1 text-xs text-ash">{row.units.available} of {row.units.total} bookable · {row.pricePerNight ? `INR ${row.pricePerNight}` : 'price on request'}{row.discountPct ? ` · ${row.discountPct}% off` : ''}</p></div><Badge tone={row.isOpen && row.units.available > 0 ? 'success' : 'warning'} icon={row.isOpen && row.units.available > 0 ? Check : undefined}>{row.isOpen && row.units.available > 0 ? 'Open' : 'Closed'}</Badge></div></Card>)}</div>}
    </>}
  </div>
}
