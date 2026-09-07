import { useState } from 'react'
import { Loader2, Store } from 'lucide-react'
import { useTrustStore } from '../../store/useTrustStore'

// Ranked by the growth formula (favors WhatsApp-onboarded, higher-tier,
// low-pressure-destination businesses) -- this just displays whatever order
// the backend returns, no re-sorting here.
export default function Businesses() {
  const { businesses, isLoadingBusinesses, searchBusinesses, businessError } = useTrustStore()
  const [destId, setDestId] = useState('manali')
  const [type, setType] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    searchBusinesses({ destId, type })
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-2 text-slate-900">
        <Store size={22} className="text-indigo-600" />
        <h1 className="text-2xl font-semibold tracking-tight">Local businesses</h1>
      </div>

      <form onSubmit={handleSubmit} className="mb-6 flex items-end gap-3">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">Destination</span>
          <input value={destId} onChange={(e) => setDestId(e.target.value)} placeholder="manali" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">Type (optional)</span>
          <input value={type} onChange={(e) => setType(e.target.value)} placeholder="homestay" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" />
        </label>
        <button type="submit" className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700">Search</button>
        {isLoadingBusinesses && <Loader2 size={18} className="animate-spin text-indigo-600" />}
      </form>

      {businessError && <p role="alert" className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{businessError}</p>}
      {!isLoadingBusinesses && businesses.length === 0 && (
        <p className="text-sm text-slate-500">No onboarded businesses match yet.</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {businesses.map((b) => (
          <div key={b._id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-800">{b.name}</span>
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">{b.type}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {b.verificationTier} · {b.onboardedVia === 'whatsapp' ? 'locally onboarded' : b.onboardedVia}
            </p>
            {b.priceRangeINR && (
              <p className="mt-1 text-xs text-slate-400">₹{b.priceRangeINR.min}–{b.priceRangeINR.max}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
