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

const POLL_MS = 15_000 // an operator's new flash offer, or this traveller's own waitlist state (e.g. "fulfilled"), can change while this page is open

/** Flash offers you can claim right now, plus standing waitlist requests for when one opens up. */
export default function OffersWaitlist() {
  const {
    offers, isLoadingOffers, fetchOffers, claimOffer,
    waitlists, isLoadingWaitlists, fetchMyWaitlists, joinWaitlist, cancelWaitlist,
    marketError,
  } = useTrustStore()

  const [destId, setDestId] = useState('manali')
  const [joinForm, setJoinForm] = useState({ windowFrom: '', windowTo: '', maxPriceINR: '' })

  // Consistent with Businesses.jsx/Alerts.jsx: show something real on first
  // paint instead of an empty state the traveller has to click Search to
  // clear, and keep both offers and waitlist state live while the page is
  // open -- an operator's new flash offer, or this traveller's own waitlist
  // entry turning "fulfilled", can both happen while it's sitting there.
  useEffect(() => {
    fetchOffers(destId)
    fetchMyWaitlists()
    const interval = setInterval(() => {
      fetchOffers(destId, { silent: true })
      fetchMyWaitlists({ silent: true })
    }, POLL_MS)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destId])

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
        <h2 className="mb-3 text-sm font-semibold text-ink">Open offers</h2>
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
              <div key={offer._id} className="rounded-xl border border-paper-dim p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink">{offer.businessId}</span>
                  <Badge tone="success">-{offer.discountPct}%</Badge>
                </div>
                <p className="mt-1 text-xs text-ash">{new Date(offer.date).toLocaleDateString()} · ₹{offer.effectivePrice}</p>
                <Button variant="primary" size="sm" fullWidth className="mt-3" onClick={() => claimOffer(offer._id)}>Claim</Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-ink">Join the waitlist</h2>
        <form onSubmit={handleJoin} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <FormField label="From"><input required type="date" value={joinForm.windowFrom} onChange={(e) => setJoinForm((p) => ({ ...p, windowFrom: e.target.value }))} className={inputClass} /></FormField>
          <FormField label="To"><input required type="date" value={joinForm.windowTo} onChange={(e) => setJoinForm((p) => ({ ...p, windowTo: e.target.value }))} className={inputClass} /></FormField>
          <FormField label="Max ₹/night" optional><input type="number" value={joinForm.maxPriceINR} onChange={(e) => setJoinForm((p) => ({ ...p, maxPriceINR: e.target.value }))} className={inputClass} /></FormField>
          <div className="flex items-end"><Button type="submit" variant="primary" fullWidth>Join waitlist</Button></div>
        </form>
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-ink">Your waitlist entries</h2>
        {isLoadingWaitlists ? (
          <LoadingState label="Loading your waitlist entries…" />
        ) : waitlists.length === 0 ? (
          <EmptyState title="You haven't joined any waitlists" description="Join one above to get notified when a discount opens up." />
        ) : (
          <div className="space-y-2">
            {waitlists.map((w) => {
              const state = waitlistState(w.state)
              return (
                <div key={w._id} className="flex items-center justify-between rounded-xl border border-paper-dim bg-white px-4 py-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-ink">{getDestinationLabel(w.destId)}</span>
                    <span className="text-ash">{new Date(w.window.from).toLocaleDateString()} – {new Date(w.window.to).toLocaleDateString()}</span>
                    <Badge tone={state.tone}>{state.label}</Badge>
                  </div>
                  <button type="button" onClick={() => cancelWaitlist(w._id)} className="text-ash transition hover:text-pressure" aria-label="Cancel this waitlist entry">
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
