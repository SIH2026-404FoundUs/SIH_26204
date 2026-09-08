import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { useTrustStore } from '../../store/useTrustStore'
import PageHeader from '../ui/PageHeader'
import Card from '../ui/Card'
import Button from '../ui/Button'
import Alert from '../ui/Alert'
import FormField, { inputClass } from '../ui/FormField'

/** Confirms a real visit happened, using the 6-digit code the business is showing right now. */
export default function VisitVerify() {
  const { verifyVisit, isVerifying, lastVisitResult, visitError } = useTrustStore()
  const [businessId, setBusinessId] = useState('')
  const [code, setCode] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    await verifyVisit({ businessId, code })
  }

  const verified = lastVisitResult?.status === 'verified'

  return (
    <div className="mx-auto max-w-md">
      <PageHeader icon={ShieldCheck} title="Verify your visit" description="Ask the business to show their current 6-digit code, then enter it below along with their ID." />

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Business ID">
            <input
              value={businessId} onChange={(e) => setBusinessId(e.target.value)} required
              placeholder="e.g. biz_shimla_homestay_01" className={inputClass}
            />
          </FormField>
          <FormField label="6-digit code">
            <input
              value={code} onChange={(e) => setCode(e.target.value)} required
              inputMode="numeric" maxLength={6} placeholder="000000"
              className={`${inputClass} text-center text-lg tracking-[0.5em]`}
            />
          </FormField>
          <Button type="submit" variant="primary" fullWidth loading={isVerifying}>Verify</Button>
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
