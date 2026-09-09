import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { useOperatorStore } from '../../store/useOperatorStore'
import PageHeader from '../ui/PageHeader'
import Card from '../ui/Card'
import Alert from '../ui/Alert'
import LoadingState from '../ui/LoadingState'
import EmptyState from '../ui/EmptyState'
import FormField, { inputClass } from '../ui/FormField'

// The operator's half of Verify a Visit: show the currently-valid code on a
// screen the traveller reads and types in (GET /v1/visits/operator-code/:id
// -- unauthenticated by design, spec §1.1: "meant to be shown on a screen
// the traveller reads, not a secret in itself"). The code itself rotates
// every 90s (povCrypto.js's STEP_DURATION_SECONDS) -- polled every 10s so
// this screen never shows a code past its window without the operator
// having to refresh manually.
const POLL_MS = 10_000

export default function OperatorVerifyVisit() {
  const { myBusinesses, isLoadingBusinesses, fetchMyBusinesses, operatorCode, isLoadingCode, codeError, fetchOperatorCode } = useOperatorStore()
  const [selectedBusinessId, setSelectedBusinessId] = useState('')

  useEffect(() => { fetchMyBusinesses() }, [fetchMyBusinesses])

  const effectiveBusinessId = selectedBusinessId || myBusinesses[0]?._id || ''

  useEffect(() => {
    if (!effectiveBusinessId) return
    fetchOperatorCode(effectiveBusinessId)
    const interval = setInterval(() => fetchOperatorCode(effectiveBusinessId), POLL_MS)
    return () => clearInterval(interval)
  }, [effectiveBusinessId, fetchOperatorCode])

  return (
    <div className="mx-auto max-w-md">
      <PageHeader icon={ShieldCheck} title="Verify a visit" description="Show this code to a traveller so they can confirm their visit. It changes automatically -- no need to do anything but keep this open." />

      {isLoadingBusinesses ? (
        <LoadingState label="Loading your businesses…" />
      ) : myBusinesses.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="Register a business first" description="Once you've registered a business, its verification code appears here." />
      ) : (
        <>
          <FormField label="Business">
            <select value={effectiveBusinessId} onChange={(e) => setSelectedBusinessId(e.target.value)} className={`${inputClass} mb-6`}>
              {myBusinesses.map((b) => <option key={b._id} value={b._id}>{b.name} · {b.destId}</option>)}
            </select>
          </FormField>

          {codeError && <Alert tone="error">{codeError}</Alert>}

          <Card className="text-center" padding="p-8">
            {isLoadingCode && !operatorCode ? (
              <p className="text-sm text-ash">Loading code…</p>
            ) : operatorCode ? (
              <>
                <p className="font-mono text-5xl font-semibold tracking-[0.3em] text-ink">{operatorCode.code}</p>
                <p className="mt-3 text-xs text-ash">Refreshes automatically · valid for about {operatorCode.expiresInSeconds}s</p>
              </>
            ) : (
              <p className="text-sm text-ash">No code available.</p>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
