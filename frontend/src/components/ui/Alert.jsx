import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react'

// Errors read in pressure ochre, positive/success in relief teal -- consistent
// with the doc's rule that those two colours always mean the same thing
// everywhere they appear (§8: "no apologetic or vague failure language").
const TONES = {
  error: { className: 'bg-pressure/10 text-pressure', icon: AlertCircle },
  success: { className: 'bg-relief/10 text-relief', icon: CheckCircle2 },
  warning: { className: 'bg-pressure/10 text-pressure', icon: TriangleAlert },
  info: { className: 'bg-ink/6 text-ink-soft', icon: Info },
}

// The one inline banner for form/page-level feedback -- rendered inline
// under the relevant field, never a toast (§Page1: "a toast would be missed
// if the user is looking at the field they need to fix").
export default function Alert({ tone = 'info', children, action }) {
  const { className, icon: Icon } = TONES[tone]
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2.5 rounded-lg px-4 py-3 text-sm ${className}`}>
      <Icon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="flex-1">{children}</div>
      {action}
    </div>
  )
}
