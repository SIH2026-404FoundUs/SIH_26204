import { useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { useTrustStore } from '../../store/useTrustStore'

const SEVERITY_STYLE = {
  info: 'bg-slate-100 text-slate-700',
  warning: 'bg-amber-100 text-amber-800',
  critical: 'bg-rose-100 text-rose-800',
}

// Every alert here is required (server-side) to carry sourceUrl + sourceName --
// shown as a citation, never hidden, so nothing reads as an unsourced claim.
export default function Alerts() {
  const { alerts, isLoadingAlerts, fetchAlerts, safetyError } = useTrustStore()
  const [destId, setDestId] = useState('manali')

  function handleSubmit(e) {
    e.preventDefault()
    fetchAlerts(destId)
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-2 text-slate-900">
        <AlertTriangle size={22} className="text-indigo-600" />
        <h1 className="text-2xl font-semibold tracking-tight">Verified alerts</h1>
      </div>

      <form onSubmit={handleSubmit} className="mb-6 flex items-end gap-3">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">Destination</span>
          <input value={destId} onChange={(e) => setDestId(e.target.value)} placeholder="manali" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" />
        </label>
        <button type="submit" className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700">Check</button>
        {isLoadingAlerts && <Loader2 size={18} className="animate-spin text-indigo-600" />}
      </form>

      {safetyError && <p role="alert" className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{safetyError}</p>}

      {!isLoadingAlerts && alerts.length === 0 && (
        <p className="text-sm text-slate-500">No active advisories for this destination right now.</p>
      )}

      <div className="space-y-3">
        {alerts.map((alert) => (
          <div key={alert._id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-1 flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${SEVERITY_STYLE[alert.severity] || SEVERITY_STYLE.info}`}>{alert.severity}</span>
              <span className="text-xs uppercase tracking-wide text-slate-400">{alert.kind}</span>
            </div>
            <p className="text-sm text-slate-800">{alert.body}</p>
            <p className="mt-2 text-xs text-slate-400">
              Source: <a href={alert.sourceUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">{alert.sourceName}</a>
              {' · valid until '}{new Date(alert.validTo).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
