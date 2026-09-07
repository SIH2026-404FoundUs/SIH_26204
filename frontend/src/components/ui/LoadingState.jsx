import { Loader2 } from 'lucide-react'

// A section that's loading is never a blank gap -- it says so.
export default function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center">
      <Loader2 size={24} className="animate-spin text-indigo-600" aria-hidden="true" />
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  )
}
