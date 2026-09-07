import { useEffect, useState } from 'react'
import { Loader2, Tag, X } from 'lucide-react'
import { useTrustStore } from '../../store/useTrustStore'

// SmartWaitlist: browse open flash offers for a destination and claim one
// (atomic on the backend -- only one caller ever wins a given offer), or join
// the standing waitlist to get notified when one opens up.
export default function OffersWaitlist() {
  const {
    offers, isLoadingOffers, fetchOffers, claimOffer,
    waitlists, isLoadingWaitlists, fetchMyWaitlists, joinWaitlist, cancelWaitlist,
    marketError,
  } = useTrustStore()

  const [destId, setDestId] = useState('manali')
  const [joinForm, setJoinForm] = useState({ windowFrom: '', windowTo: '', maxPriceINR: '', travellers: 1 })

  useEffect(() => {
    fetchMyWaitlists()
  }, [fetchMyWaitlists])

  function loadOffers(e) {
    e?.preventDefault()
    fetchOffers(destId)
  }

  async function handleJoin(e) {
    e.preventDefault()
    await joinWaitlist({
      destId,
      windowFrom: joinForm.windowFrom,
      windowTo: joinForm.windowTo,
      maxPriceINR: Number(joinForm.maxPriceINR) || undefined,
      travellers: Number(joinForm.travellers) || 1,
    })
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-2 text-slate-900">
        <Tag size={22} className="text-indigo-600" />
        <h1 className="text-2xl font-semibold tracking-tight">Offers &amp; waitlist</h1>
      </div>

      <form onSubmit={loadOffers} className="mb-6 flex items-end gap-3">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">Destination</span>
          <input value={destId} onChange={(e) => setDestId(e.target.value)} placeholder="manali" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" />
        </label>
        <button type="submit" className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700">
          Show open offers
        </button>
        {isLoadingOffers && <Loader2 size={18} className="animate-spin text-indigo-600" />}
      </form>

      {marketError && <p role="alert" className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{marketError}</p>}

      <div className="mb-8 grid gap-2 sm:grid-cols-2">
        {!isLoadingOffers && offers.length === 0 && (
          <p className="text-sm text-slate-500">No open offers for this destination right now.</p>
        )}
        {offers.map((offer) => (
          <div key={offer._id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-800">{offer.businessId}</span>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">-{offer.discountPct}%</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{new Date(offer.date).toLocaleDateString()} · ₹{offer.effectivePrice}</p>
            <button
              type="button"
              onClick={() => claimOffer(offer._id)}
              className="mt-3 w-full rounded-lg bg-indigo-600 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700"
            >
              Claim
            </button>
          </div>
        ))}
      </div>

      <h2 className="mb-3 text-lg font-semibold text-slate-900">Join the waitlist</h2>
      <form onSubmit={handleJoin} className="mb-6 grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-4">
        <input required type="date" value={joinForm.windowFrom} onChange={(e) => setJoinForm((p) => ({ ...p, windowFrom: e.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500" />
        <input required type="date" value={joinForm.windowTo} onChange={(e) => setJoinForm((p) => ({ ...p, windowTo: e.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500" />
        <input type="number" placeholder="Max ₹/night" value={joinForm.maxPriceINR} onChange={(e) => setJoinForm((p) => ({ ...p, maxPriceINR: e.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500" />
        <button type="submit" className="rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700">Join</button>
      </form>

      <h2 className="mb-3 text-lg font-semibold text-slate-900">My waitlist entries</h2>
      {isLoadingWaitlists ? (
        <Loader2 size={18} className="animate-spin text-indigo-600" />
      ) : waitlists.length === 0 ? (
        <p className="text-sm text-slate-500">You haven't joined any waitlists yet.</p>
      ) : (
        <div className="space-y-2">
          {waitlists.map((w) => (
            <div key={w._id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-sm">
                <span className="font-medium text-slate-800">{w.destId}</span>
                <span className="ml-2 text-slate-500">{new Date(w.window.from).toLocaleDateString()} – {new Date(w.window.to).toLocaleDateString()} · {w.state}</span>
              </div>
              <button type="button" onClick={() => cancelWaitlist(w._id)} className="text-slate-400 transition hover:text-rose-600" aria-label="Cancel">
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
