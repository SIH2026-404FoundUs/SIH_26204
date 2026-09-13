import { useEffect, useState } from 'react'
import { ShieldCheck, Star, MessageSquareText } from 'lucide-react'
import { useTrustStore } from '../../store/useTrustStore'
import PageHeader from '../ui/PageHeader'
import Card from '../ui/Card'
import Button from '../ui/Button'
import Alert from '../ui/Alert'
import FormField, { inputClass } from '../ui/FormField'
import DestinationSelect from '../ui/DestinationSelect'

// AI Tourist Feedback Intelligence (spec §3.2) submission -- shown right
// after a successful verify, since that's the one moment this traveller can
// prove (server-side, against the same Visit row just written) that they
// were actually at this business. One feedback form per verified visit;
// submitting resets so a second visit later can leave another one.
function FeedbackForm({ businessId }) {
  const { submitFeedback, isSubmittingFeedback, feedbackResult, feedbackError } = useTrustStore()
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    await submitFeedback({ businessId, rating, comment })
  }

  if (feedbackResult?.success) {
    return (
      <Alert tone="success">
        Thanks for the feedback -- it helps this business improve, and future travellers make better choices.
      </Alert>
    )
  }

  return (
    <Card className="mt-3">
      <div className="mb-3 flex items-center gap-2">
        <MessageSquareText size={17} className="text-pressure" aria-hidden="true" />
        <p className="text-sm font-semibold text-ink">How was it?</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <FormField label="Rating">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                aria-label={`${n} star${n === 1 ? '' : 's'}`}
                className="p-0.5"
              >
                <Star size={22} className={n <= rating ? 'fill-pressure text-pressure' : 'text-paper-dim'} />
              </button>
            ))}
          </div>
        </FormField>
        <FormField label="What stood out?" hint="Specific details (cleanliness, staff, food, price...) help the most">
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} required className={inputClass} />
        </FormField>
        {feedbackError && <Alert tone="error">{feedbackError}</Alert>}
        <Button type="submit" variant="primary" fullWidth loading={isSubmittingFeedback} disabled={!rating || !comment.trim()}>
          Submit feedback
        </Button>
      </form>
    </Card>
  )
}

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
  const [verifiedBusinessId, setVerifiedBusinessId] = useState(null)

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
    const ok = await verifyVisit({ businessId, code })
    if (ok) setVerifiedBusinessId(businessId) // captured now -- changing destination/business afterward shouldn't retarget the feedback form
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

      {verified && verifiedBusinessId && <FeedbackForm businessId={verifiedBusinessId} />}
    </div>
  )
}
