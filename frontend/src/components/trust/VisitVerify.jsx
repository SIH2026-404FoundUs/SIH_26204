import { useState } from 'react'
import { Loader2, ShieldCheck } from 'lucide-react'
import { useTrustStore } from '../../store/useTrustStore'

// Traveller-side half of Proof-of-Visit: enter the business ID and the
// 6-digit rotating code the operator's device is showing right now.
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
      <div className="mb-6 flex items-center gap-2 text-slate-900">
        <ShieldCheck size={22} className="text-indigo-600" />
        <h1 className="text-2xl font-semibold tracking-tight">Proof of Visit</h1>
      </div>
      <p className="mb-6 text-sm text-slate-500">
        Ask the business to show their current code, then enter it here along with their business ID.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="block text-left">
          <span className="mb-2 block text-sm font-medium text-slate-700">Business ID</span>
          <input
            value={businessId}
            onChange={(e) => setBusinessId(e.target.value)}
            required
            placeholder="e.g. biz_shimla_homestay_01"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
          />
        </label>
        <label className="block text-left">
          <span className="mb-2 block text-sm font-medium text-slate-700">6-digit code</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-lg tracking-[0.5em] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
          />
        </label>
        <button
          type="submit"
          disabled={isVerifying}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isVerifying && <Loader2 size={16} className="animate-spin" />}
          Verify
        </button>
      </form>

      {visitError && (
        <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{visitError}</p>
      )}

      {lastVisitResult && (
        <div className={`mt-4 rounded-xl px-4 py-3 text-sm ${verified ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
          {verified ? (
            <>
              <p className="font-semibold">Visit verified.</p>
              <p>New tier: {lastVisitResult.tierAfter} · total visits: {lastVisitResult.visitCount}</p>
            </>
          ) : (
            <p>{lastVisitResult.message || lastVisitResult.reasonCode}</p>
          )}
        </div>
      )}
    </div>
  )
}
