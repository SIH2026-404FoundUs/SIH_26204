import { useEffect, useState } from 'react'
import { Tag, X, Search } from 'lucide-react'
import { useTrustStore } from '../../store/useTrustStore'
import { getDestinationLabel } from '../../lib/destinations'
import { waitlistState } from '../../lib/labels'
import PageHeader from '../ui/PageHeader'
import Card from '../ui/Card'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import Alert from '../ui/Alert'
import EmptyState from '../ui/EmptyState'
import LoadingState from '../ui/LoadingState'
import FormField, { inputClass } from '../ui/FormField'
import DestinationSelect from '../ui/DestinationSelect'

/** Flash offers you can claim right now, plus standing waitlist requests for when one opens up. */
export default function OffersWaitlist() {
  const {
    offers, isLoadingOffers, fetchOffers, claimOffer,
    waitlists, isLoadingWaitlists, fetchMyWaitlists, joinWaitlist, cancelWaitlist,
    marketError,
  } = useTrustStore()

  const [destId, setDestId] = useState('manali')
  const [joinForm, setJoinForm] = useState({ windowFrom: '', windowTo: '', maxPriceINR: '' })

  useEffect(() => { fetchMyWaitlists() }, [fetchMyWaitlists])

  const loadOffers = (e) => { e?.preventDefault(); fetchOffers(destId) }
  const handleJoin = async (e) => {
    e.preventDefault()
    await joinWaitlist({ destId, windowFrom: joinForm.windowFrom, windowTo: joinForm.windowTo, maxPriceINR: Number(joinForm.maxPriceINR) || undefined })
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader icon={Tag} title="Offers & waitlist" description="Claim a flash discount from a business right now, or join the waitlist to hear about one." />

      {marketError && <div className="mb-4"><Alert tone="error">{marketError}</Alert></div>}

      <Card className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Open offers</h2>
        <form onSubmit={loadOffers} className="mb-4 flex items-end gap-3">
          <div className="flex-1"><FormField label="Destination"><DestinationSelect value={destId} onChange={setDestId} /></FormField></div>
          <Button type="submit" variant="primary" icon={Search} loading={isLoadingOffers}>Search</Button>
        </form>

        {isLoadingOffers ? (
          <LoadingState label="Looking for open offers…" />
        ) : offers.length === 0 ? (
          <EmptyState title="No open offers right now" description={`Nothing available in ${getDestinationLabel(destId)} at the moment — try joining the waitlist below.`} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {offers.map((offer) => (
              <div key={offer._id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-800">{offer.businessId}</span>
                  <Badge tone="success">-{offer.discountPct}%</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500">{new Date(offer.date).toLocaleDateString()} · ₹{offer.effectivePrice}</p>
                <Button variant="primary" size="sm" fullWidth className="mt-3" onClick={() => claimOffer(offer._id)}>Claim</Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Join the waitlist</h2>
        <form onSubmit={handleJoin} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <FormField label="From"><input required type="date" value={joinForm.windowFrom} onChange={(e) => setJoinForm((p) => ({ ...p, windowFrom: e.target.value }))} className={inputClass} /></FormField>
          <FormField label="To"><input required type="date" value={joinForm.windowTo} onChange={(e) => setJoinForm((p) => ({ ...p, windowTo: e.target.value }))} className={inputClass} /></FormField>
          <FormField label="Max ₹/night" optional><input type="number" value={joinForm.maxPriceINR} onChange={(e) => setJoinForm((p) => ({ ...p, maxPriceINR: e.target.value }))} className={inputClass} /></FormField>
          <div className="flex items-end"><Button type="submit" variant="primary" fullWidth>Join waitlist</Button></div>
        </form>
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Your waitlist entries</h2>
        {isLoadingWaitlists ? (
          <LoadingState label="Loading your waitlist entries…" />
        ) : waitlists.length === 0 ? (
          <EmptyState title="You haven't joined any waitlists" description="Join one above to get notified when a discount opens up." />
        ) : (
          <div className="space-y-2">
            {waitlists.map((w) => {
              const state = waitlistState(w.state)
              return (
                <div key={w._id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-slate-800">{getDestinationLabel(w.destId)}</span>
                    <span className="text-slate-400">{new Date(w.window.from).toLocaleDateString()} – {new Date(w.window.to).toLocaleDateString()}</span>
                    <Badge tone={state.tone}>{state.label}</Badge>
                  </div>
                  <button type="button" onClick={() => cancelWaitlist(w._id)} className="text-slate-400 transition hover:text-rose-600" aria-label="Cancel this waitlist entry">
                    <X size={16} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
