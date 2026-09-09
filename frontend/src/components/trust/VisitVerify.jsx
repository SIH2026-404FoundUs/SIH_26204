import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { useTrustStore } from '../../store/useTrustStore'
import PageHeader from '../ui/PageHeader'
import Card from '../ui/Card'
import Button from '../ui/Button'
import Alert from '../ui/Alert'
import FormField, { inputClass } from '../ui/FormField'
import DestinationSelect from '../ui/DestinationSelect'

// Verifying a visit now starts with "place of visit", not a raw business ID
// the traveller has to already know -- picking a destination searches the
// same existing business directory (useTrustStore.searchBusinesses, the
// GET /v1/businesses/search API already used by Available Services), and
// the traveller picks their business from real results instead of typing
// an ID. POST /v1/visits/verify's own contract is unchanged -- it still
// only ever receives {businessId, code}.
export default function VisitVerify() {
  const {
    verifyVisit, isVerifying, lastVisitResult, visitError,
    businesses, isLoadingBusinesses, searchBusinesses,
  } = useTrustStore()
  const [destId, setDestId] = useState('')
  const [businessId, setBusinessId] = useState('')
  const [code, setCode] = useState('')

  useEffect(() => {
    if (!destId) return
    searchBusinesses({ destId })
  }, [destId, searchBusinesses])

  function handleDestChange(nextDestId) {
    setDestId(nextDestId)
    setBusinessId('') // last selection was for the previous destination's list
  }

  async function handleSubmit(e) {
    e.preventDefault()
    await verifyVisit({ businessId, code })
  }

  const verified = lastVisitResult?.status === 'verified'

  return (
    <div className="mx-auto max-w-md">
      <PageHeader icon={ShieldCheck} title="Verify your visit" description="Pick where you visited, then ask the business to show their current 6-digit code." />

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Place of visit">
            <DestinationSelect value={destId} onChange={handleDestChange} required />
          </FormField>

          <FormField label="Business" hint={destId && !isLoadingBusinesses && businesses.length === 0 ? 'No businesses onboarded here yet.' : undefined}>
            <select
              value={businessId}
              onChange={(e) => setBusinessId(e.target.value)}
              required
              disabled={!destId || isLoadingBusinesses}
              className={inputClass}
            >
              <option value="" disabled>{isLoadingBusinesses ? 'Loading businesses…' : 'Choose a business'}</option>
              {businesses.map((b) => (
                <option key={b._id} value={b._id}>{b.name} ({b.type})</option>
              ))}
            </select>
          </FormField>

          <FormField label="6-digit code">
            <input
              value={code} onChange={(e) => setCode(e.target.value)} required
              inputMode="numeric" maxLength={6} placeholder="000000"
              className={`${inputClass} text-center text-lg tracking-[0.5em]`}
            />
          </FormField>
          <Button type="submit" variant="primary" fullWidth loading={isVerifying} disabled={!businessId}>Verify</Button>
        </form>
      </Card>

      {visitError && <Alert tone="error" >{visitError}</Alert>}

      {lastVisitResult && (
        <div className="mt-4">
          {verified ? (
            <Alert tone="success">
              <p className="font-medium">Visit verified.</p>
              <p className="mt-0.5 text-relief">You now have {lastVisitResult.visitCount} verified {lastVisitResult.visitCount === 1 ? 'visit' : 'visits'}.</p>
            </Alert>
          ) : (
            <Alert tone="error">{lastVisitResult.message || 'That code could not be verified.'}</Alert>
          )}
        </div>
      )}
    </div>
  )
}
