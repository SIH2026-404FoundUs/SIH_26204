import { useState } from 'react'
import { Loader2, MapPinned } from 'lucide-react'
import { useTrustStore } from '../../store/useTrustStore'

// Submitting a hidden place. The backend gates this on having >=1 verified
// visit anywhere on the platform -- if that's not true yet, the 403 comes
// back with a clear reasonCode and we just show it, no special-casing here.
export default function CommunitySubmit() {
  const { submitCommunityPlace, isSubmittingPlace, communityResult, communityError } = useTrustStore()
  const [form, setForm] = useState({ name: '', lat: '', lng: '', description: '' })

  function update(field) {
    return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    await submitCommunityPlace({
      name: form.name,
      lat: Number(form.lat),
      lng: Number(form.lng),
      description: form.description,
    })
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-6 flex items-center gap-2 text-slate-900">
        <MapPinned size={22} className="text-indigo-600" />
        <h1 className="text-2xl font-semibold tracking-tight">Submit a hidden place</h1>
      </div>
      <p className="mb-6 text-sm text-slate-500">
        Found somewhere not on the map yet? Submit it for review. You need at least one verified visit anywhere on the platform to submit.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="block text-left">
          <span className="mb-2 block text-sm font-medium text-slate-700">Name</span>
          <input value={form.name} onChange={update('name')} required placeholder="Hidden waterfall" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-left">
            <span className="mb-2 block text-sm font-medium text-slate-700">Latitude</span>
            <input value={form.lat} onChange={update('lat')} required type="number" step="any" placeholder="32.24" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" />
          </label>
          <label className="block text-left">
            <span className="mb-2 block text-sm font-medium text-slate-700">Longitude</span>
            <input value={form.lng} onChange={update('lng')} required type="number" step="any" placeholder="77.19" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" />
          </label>
        </div>
        <label className="block text-left">
          <span className="mb-2 block text-sm font-medium text-slate-700">Description</span>
          <textarea value={form.description} onChange={update('description')} rows={3} placeholder="What makes it worth visiting?" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" />
        </label>
        <button type="submit" disabled={isSubmittingPlace} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">
          {isSubmittingPlace && <Loader2 size={16} className="animate-spin" />}
          Submit for review
        </button>
      </form>

      {communityError && (
        <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{communityError}</p>
      )}
      {communityResult?.success && (
        <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Submitted — queued for review (status: {communityResult.submission?.status}).
        </p>
      )}
    </div>
  )
}
