import { useEffect, useMemo, useState } from 'react'
import { Tag, X, Search, Clock, Store, ListPlus } from 'lucide-react'
import { useTrustStore } from '../../store/useTrustStore'
import { getDestinationLabel } from '../../lib/destinations'
import { waitlistState } from '../../lib/labels'
import { timeUntil } from '../../lib/time'
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

// One flash-offer card. Real, previously-unsurfaced fields now shown: the
// actual business name (resolved from the same destId's business search --
// Offer itself only ever stores businessId, this file was rendering that
// raw id string before), the real discount math (struck-through
// originalPrice -> effectivePrice, not just the percentage), and a live
// "expires in" countdown off the offer's real expiresAt -- a flash offer is
// supposed to feel urgent, and a bare date string didn't communicate that.
function OfferCard({ offer, businessName, onClaim }) {
  const [remaining, setRemaining] = useState(() => timeUntil(offer.expiresAt))
  useEffect(() => {
    const id = setInterval(() => setRemaining(timeUntil(offer.expiresAt)), 30_000)
    return () => clearInterval(id)
  }, [offer.expiresAt])

  return (
    <Card padding="p-4" className="border-l-4 border-l-pressure">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-paper">
            <Store size={14} aria-hidden="true" />
          </span>
          <span className="truncate text-sm font-semibold text-ink">{businessName || 'A local business'}</span>
        </div>
        <Badge tone="warning">-{offer.discountPct}%</Badge>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        {offer.originalPrice > 0 && <span className="text-xs text-ash line-through">₹{offer.originalPrice}</span>}
        <span className="font-display text-lg text-ink">₹{offer.effectivePrice}</span>
      </div>

      <div className="mt-1 flex items-center justify-between text-xs text-ash">
        <span>{new Date(offer.date).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
        <span className={`flex items-center gap-1 font-medium ${remaining === 'expired' ? 'text-pressure' : 'text-ink/60'}`}>
          <Clock size={12} aria-hidden="true" /> {remaining === 'expired' ? 'Expired' : `Expires in ${remaining}`}
        </span>
      </div>

      <Button variant="primary" size="sm" fullWidth className="mt-3" disabled={remaining === 'expired'} onClick={() => onClaim(offer._id)}>
        Claim this offer
      </Button>
    </Card>
  )
}

/** Flash offers you can claim right now, plus standing waitlist requests for when one opens up. */
export default function OffersWaitlist() {
  const {
    offers, isLoadingOffers, fetchOffers, claimOffer,
    waitlists, isLoadingWaitlists, fetchMyWaitlists, joinWaitlist, cancelWaitlist,
    marketError, businesses, searchBusinesses,
  } = useTrustStore()

  const [tab, setTab] = useState('offers') // 'offers' | 'waitlist'
  const [destId, setDestId] = useState('manali')
  const [joinForm, setJoinForm] = useState({ windowFrom: '', windowTo: '', maxPriceINR: '' })

  // Consistent with Businesses.jsx/Alerts.jsx: show something real on first
  // paint instead of an empty state the traveller has to click Search to
  // clear, and keep both offers and waitlist state live while the page is
  // open -- an operator's new flash offer, or this traveller's own waitlist
  // entry turning "fulfilled", can both happen while it's sitting there.
  useEffect(() => {
    fetchOffers(destId)
    searchBusinesses({ destId }) // resolves each offer's businessId into a real name below
    fetchMyWaitlists()
    const interval = setInterval(() => {
      fetchOffers(destId, { silent: true })
      fetchMyWaitlists({ silent: true })
    }, POLL_MS)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destId])

  const businessNameById = useMemo(
    () => Object.fromEntries(businesses.map((b) => [b._id, b.name])),
    [businesses]
  )

  // "Your waitlist entries" is meant to show what's actually still waiting --
  // a cancelled entry the traveller dismissed, or one already fulfilled (and
  // surfaced instead via the waitlist-fulfilled notification/email), has
  // nothing left to act on here and was cluttering the list.
  const activeWaitlists = useMemo(() => waitlists.filter((w) => w.state === 'waiting'), [waitlists])

  const loadOffers = (e) => { e?.preventDefault(); fetchOffers(destId) }
  const handleJoin = async (e) => {
    e.preventDefault()
    await joinWaitlist({ destId, windowFrom: joinForm.windowFrom, windowTo: joinForm.windowTo, maxPriceINR: Number(joinForm.maxPriceINR) || undefined })
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader icon={Tag} title="Offers & waitlist" description="Claim a flash discount from a business right now, or join the waitlist to hear about one." />

      {marketError && <div className="mb-4"><Alert tone="error">{marketError}</Alert></div>}

      <div className="mb-6 flex items-center gap-2 rounded-lg bg-paper-dim/50 p-1">
        <button
          type="button"
          onClick={() => setTab('offers')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-sm font-semibold transition ${tab === 'offers' ? 'bg-white text-ink shadow-sm' : 'text-ink/60'}`}
        >
          <Tag size={15} aria-hidden="true" /> Offers
          {offers.length > 0 && <Badge tone="warning">{offers.length}</Badge>}
        </button>
        <button
          type="button"
          onClick={() => setTab('waitlist')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-sm font-semibold transition ${tab === 'waitlist' ? 'bg-white text-ink shadow-sm' : 'text-ink/60'}`}
        >
          <ListPlus size={15} aria-hidden="true" /> Join waitlist
          {activeWaitlists.length > 0 && <Badge tone="info">{activeWaitlists.length}</Badge>}
        </button>
      </div>

      {tab === 'offers' ? (
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <Tag size={17} className="text-pressure" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-ink">Open offers</h2>
          </div>
          <form onSubmit={loadOffers} className="mb-4 flex items-end gap-3">
            <div className="flex-1"><FormField label="Destination"><DestinationSelect value={destId} onChange={setDestId} /></FormField></div>
            <Button type="submit" variant="primary" icon={Search} loading={isLoadingOffers}>Search</Button>
          </form>

          {isLoadingOffers ? (
            <LoadingState label="Looking for open offers…" />
          ) : offers.length === 0 ? (
            <EmptyState icon={Tag} title="No open offers right now" description={`Nothing available in ${getDestinationLabel(destId)} at the moment — try the waitlist tab instead.`} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {offers.map((offer) => (
                <OfferCard key={offer._id} offer={offer} businessName={businessNameById[offer.businessId]} onClaim={claimOffer} />
              ))}
            </div>
          )}
        </Card>
      ) : (
        <>
          <Card className="mb-6">
            <div className="mb-4 flex items-center gap-2">
              <ListPlus size={17} className="text-relief" aria-hidden="true" />
              <div>
                <h2 className="text-sm font-semibold text-ink">Join the waitlist</h2>
                <p className="text-xs text-ash">Tell us your window and we'll notify you the moment a matching offer opens.</p>
              </div>
            </div>
            <form onSubmit={handleJoin} className="space-y-3">
              <FormField label="Destination"><DestinationSelect value={destId} onChange={setDestId} /></FormField>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <FormField label="From"><input required type="date" value={joinForm.windowFrom} onChange={(e) => setJoinForm((p) => ({ ...p, windowFrom: e.target.value }))} className={inputClass} /></FormField>
                <FormField label="To"><input required type="date" value={joinForm.windowTo} onChange={(e) => setJoinForm((p) => ({ ...p, windowTo: e.target.value }))} className={inputClass} /></FormField>
                <FormField label="Max ₹/night" optional><input type="number" value={joinForm.maxPriceINR} onChange={(e) => setJoinForm((p) => ({ ...p, maxPriceINR: e.target.value }))} className={inputClass} /></FormField>
                <div className="flex items-end"><Button type="submit" variant="primary" fullWidth>Join waitlist</Button></div>
              </div>
            </form>
          </Card>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">Your waitlist entries</h2>
              {activeWaitlists.length > 0 && <Badge tone="info">{activeWaitlists.length} {activeWaitlists.length === 1 ? 'entry' : 'entries'}</Badge>}
            </div>
            {isLoadingWaitlists ? (
              <LoadingState label="Loading your waitlist entries…" />
            ) : activeWaitlists.length === 0 ? (
              <EmptyState icon={ListPlus} title="You haven't joined any waitlists" description="Join one above to get notified when a discount opens up." />
            ) : (
              <div className="space-y-2">
                {activeWaitlists.map((w) => {
                  const state = waitlistState(w.state)
                  return (
                    <Card key={w._id} padding="p-4" className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-ink">{getDestinationLabel(w.destId)}</span>
                        <span className="text-ash">{new Date(w.window.from).toLocaleDateString()} – {new Date(w.window.to).toLocaleDateString()}</span>
                        <Badge tone={state.tone}>{state.label}</Badge>
                      </div>
                      <button type="button" onClick={() => cancelWaitlist(w._id)} className="text-ash transition hover:text-pressure" aria-label="Cancel this waitlist entry">
                        <X size={16} />
                      </button>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
