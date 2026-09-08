import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, Search } from 'lucide-react'
import { useSubstitutionStore } from '../../store/useSubstitutionStore'
import SwapCard from './SwapCard'
import PageHeader from '../ui/PageHeader'
import Card from '../ui/Card'
import Button from '../ui/Button'
import Alert from '../ui/Alert'
import LoadingState from '../ui/LoadingState'
import FormField, { inputClass } from '../ui/FormField'
import DestinationSelect from '../ui/DestinationSelect'

export default function SwapPage() {
  const navigate = useNavigate()
  const { result, isLoading, error, getAlternatives } = useSubstitutionStore()

  const [form, setForm] = useState({
    origin: 'delhi',
    destId: 'manali',
    startDate: '2026-12-26',
    endDate: '2026-12-28',
    travellers: 2,
    budgetINR: 12000,
  })

  useEffect(() => {
    getAlternatives(form)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleChange = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))
  const handleSubmit = (e) => {
    e.preventDefault()
    getAlternatives(form)
  }

  const handleAcceptPlace = (place) => {
    navigate('/trip-confirmation', {
      state: { type: 'place', requested: result?.requested || { destId: form.destId }, selected: place },
    })
  }
  const handleAcceptDate = (dateObj) => {
    navigate('/trip-confirmation', {
      state: { type: 'date', requested: result?.requested || { destId: form.destId }, selected: dateObj },
    })
  }
  const handleDecline = () => {
    navigate('/trip-confirmation', {
      state: { type: 'decline', requested: result?.requested || { destId: form.destId } },
    })
  }

  return (
    <main className="flex-1 bg-paper px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <PageHeader
          icon={MapPin}
          title="Alternatives"
          description="Check how busy a destination will be on your dates, and see quieter alternatives if it's crowded."
        />

        <Card className="mb-6">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FormField label="Travelling from">
              <input
                type="text" value={form.origin} onChange={(e) => handleChange('origin', e.target.value)}
                placeholder="e.g. Delhi" required className={inputClass}
              />
            </FormField>
            <FormField label="Destination">
              <DestinationSelect value={form.destId} onChange={(v) => handleChange('destId', v)} />
            </FormField>
            <FormField label="Start date">
              <input
                type="date" value={form.startDate} onChange={(e) => handleChange('startDate', e.target.value)}
                required className={inputClass}
              />
            </FormField>
            <div className="flex items-end">
              <Button type="submit" variant="primary" fullWidth loading={isLoading} icon={Search}>
                Check crowding
              </Button>
            </div>
          </form>
        </Card>

        {isLoading && <LoadingState label="Checking crowding and looking for alternatives…" />}

        {error && !isLoading && (
          <Alert tone="error" action={<Button variant="danger" size="sm" onClick={() => getAlternatives(form)}>Retry</Button>}>
            {error}
          </Alert>
        )}

        {!isLoading && !error && result && <SwapCard data={result} onAcceptPlace={handleAcceptPlace} onAcceptDate={handleAcceptDate} onDecline={handleDecline} />}
      </div>
    </main>
  )
}
