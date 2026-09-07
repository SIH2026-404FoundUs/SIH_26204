import { useState } from 'react'
import { Loader2, Phone } from 'lucide-react'
import { useTrustStore } from '../../store/useTrustStore'

const CATEGORIES = [
  'safety_advisory', 'overcharging_pricing', 'hygiene_cleanliness',
  'service_misrepresentation', 'transport_issue', 'other',
]

export default function Safety() {
  const {
    emergencyContacts, fetchEmergencyContacts,
    submitComplaint, isSubmittingComplaint, complaintResult, safetyError,
  } = useTrustStore()

  const [destId, setDestId] = useState('manali')
  const [complaint, setComplaint] = useState({ destId: 'manali', category: 'other', text: '' })

  async function handleComplaint(e) {
    e.preventDefault()
    await submitComplaint(complaint)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <div>
        <div className="mb-4 flex items-center gap-2 text-slate-900">
          <Phone size={22} className="text-indigo-600" />
          <h1 className="text-2xl font-semibold tracking-tight">Emergency contacts</h1>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); fetchEmergencyContacts(destId) }} className="mb-4 flex items-end gap-3">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Destination</span>
            <input value={destId} onChange={(e) => setDestId(e.target.value)} placeholder="manali" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" />
          </label>
          <button type="submit" className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700">Look up</button>
        </form>
        {emergencyContacts && (
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-4 text-sm sm:grid-cols-3">
            {['police', 'ambulance', 'disasterHelpline', 'controlRoom', 'touristPolice'].map((key) =>
              emergencyContacts[key] ? (
                <div key={key}>
                  <p className="text-xs uppercase tracking-wide text-slate-400">{key}</p>
                  <p className="font-medium text-slate-800">{emergencyContacts[key]}</p>
                </div>
              ) : null
            )}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-4 text-xl font-semibold text-slate-900">Report a problem</h2>
        <form onSubmit={handleComplaint} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid grid-cols-2 gap-3">
            <input required placeholder="Destination" value={complaint.destId} onChange={(e) => setComplaint((p) => ({ ...p, destId: e.target.value }))} className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" />
            <select value={complaint.category} onChange={(e) => setComplaint((p) => ({ ...p, category: e.target.value }))} className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c.replaceAll('_', ' ')}</option>)}
            </select>
          </div>
          <textarea required rows={3} placeholder="What happened?" value={complaint.text} onChange={(e) => setComplaint((p) => ({ ...p, text: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" />
          <button type="submit" disabled={isSubmittingComplaint} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">
            {isSubmittingComplaint && <Loader2 size={16} className="animate-spin" />}
            Submit
          </button>
        </form>
        {safetyError && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{safetyError}</p>}
        {complaintResult?.success && (
          <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{complaintResult.disclaimer}</p>
        )}
      </div>
    </div>
  )
}
