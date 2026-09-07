import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react'

const TONES = {
  error: { className: 'bg-rose-50 text-rose-700', icon: AlertCircle },
  success: { className: 'bg-emerald-50 text-emerald-700', icon: CheckCircle2 },
  warning: { className: 'bg-amber-50 text-amber-800', icon: TriangleAlert },
  info: { className: 'bg-slate-100 text-slate-700', icon: Info },
}

// The one inline banner for form/page-level feedback -- replaces the mix of
// ad-hoc rose/emerald boxes each page was building on its own.
export default function Alert({ tone = 'info', children, action }) {
  const { className, icon: Icon } = TONES[tone]
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm ${className}`}>
      <Icon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="flex-1">{children}</div>
      {action}
    </div>
  )
}
