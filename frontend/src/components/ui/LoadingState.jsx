import { Loader2 } from 'lucide-react'

// A section that's loading is never a blank gap -- it says so.
export default function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-paper-dim bg-white px-6 py-10 text-center">
      <Loader2 size={24} className="animate-spin text-pressure" aria-hidden="true" />
      <p className="text-sm text-ink/60">{label}</p>
    </div>
  )
}
