import { useEffect, useState } from 'react'
import { TriangleAlert, X } from 'lucide-react'
import { useBroadcastAlertStore } from '../../store/useBroadcastAlertStore'

// Dismissal is keyed per-alert-id in localStorage, not a blanket "hide
// banners" toggle -- dismissing today's flood advisory must not silently
// hide tomorrow's landslide warning. No expiry needed: once an alert is
// resolved by an authority it drops out of the active list entirely (see
// useBroadcastAlertStore.fetchActive), so a stale id here just never
// matches anything again.
const DISMISSED_KEY = 'sahyatri:broadcast:dismissed'
function loadDismissed() {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]'))
  } catch {
    return new Set()
  }
}
function saveDismissed(ids) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]))
  } catch {
    // Private browsing / storage disabled -- dismissal just won't persist across reloads.
  }
}

const SEVERITY_STYLE = {
  critical: 'bg-pressure text-white',
  warning: 'bg-amber-500 text-ink',
  info: 'bg-ink text-paper',
}

const POLL_MS = 60_000 // a disaster notice can't wait for the header's own 15s notification poll to matter, but every page (incl. signed-out) needs this, so it runs independently

// Platform-wide emergency broadcasts from an authority (Revised
// Implementation Plan-style "alert all accounts" requirement) -- rendered
// above the header on every page, public and authenticated alike, since a
// disaster notice has to reach a visitor who hasn't signed in too.
export default function EmergencyBanner() {
  const { activeAlerts, fetchActive } = useBroadcastAlertStore()
  const [dismissed, setDismissed] = useState(loadDismissed)

  useEffect(() => {
    fetchActive({ silent: true })
    const interval = setInterval(() => fetchActive({ silent: true }), POLL_MS)
    return () => clearInterval(interval)
  }, [fetchActive])

  const visible = activeAlerts.filter((a) => !dismissed.has(a._id))
  if (visible.length === 0) return null

  const dismiss = (id) => {
    setDismissed((prev) => {
      const next = new Set(prev)
      next.add(id)
      saveDismissed(next)
      return next
    })
  }

  return (
    <div role="alert" className="relative z-[60]">
      {visible.map((alert) => (
        <div key={alert._id} className={`flex items-start gap-3 px-4 py-3 text-sm sm:px-6 ${SEVERITY_STYLE[alert.severity] || SEVERITY_STYLE.critical}`}>
          <TriangleAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{alert.title}</p>
            <p className="mt-0.5 opacity-90">{alert.body}</p>
          </div>
          <button
            type="button"
            onClick={() => dismiss(alert._id)}
            aria-label="Dismiss this alert"
            className="shrink-0 rounded p-0.5 opacity-80 transition hover:opacity-100"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  )
}
