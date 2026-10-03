import { useEffect, useState } from 'react'
import { Siren, Send, CheckCircle2 } from 'lucide-react'
import { useBroadcastAlertStore } from '../../../store/useBroadcastAlertStore'
import { alertSeverity } from '../../../lib/labels'
import PageHeader from '../../ui/PageHeader'
import Card from '../../ui/Card'
import Badge from '../../ui/Badge'
import Button from '../../ui/Button'
import Alert from '../../ui/Alert'
import LoadingState from '../../ui/LoadingState'
import EmptyState from '../../ui/EmptyState'
import Modal from '../../ui/Modal'
import FormField, { inputClass } from '../../ui/FormField'

const SEVERITY_OPTIONS = [
  { value: 'critical', label: 'Critical -- disaster / immediate danger' },
  { value: 'warning', label: 'Warning -- serious, not immediately life-threatening' },
  { value: 'info', label: 'Informational -- advisory only' },
]

// Authority-only: compose and send a platform-wide emergency broadcast
// (Revised Implementation Plan's "alert all accounts" requirement). Every
// account gets emailed and every open tab picks it up within a minute via
// the site-wide banner (EmergencyBanner.jsx) -- this page only manages the
// sending and resolving, not the display, matching how AuthorityComplaints
// is its own workspace separate from where complaints actually surface.
export default function AuthorityAlerts() {
  const {
    activeAlerts, isLoading, error, isSending, sendError, resolvingId, resolveError,
    fetchActive, sendBroadcast, resolveBroadcast,
  } = useBroadcastAlertStore()

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [severity, setSeverity] = useState('critical')
  const [confirming, setConfirming] = useState(false)
  const [sentNotice, setSentNotice] = useState(null)

  useEffect(() => { fetchActive() }, [fetchActive])

  async function handleConfirmSend() {
    const result = await sendBroadcast({ title: title.trim(), body: body.trim(), severity })
    setConfirming(false)
    if (result) {
      setSentNotice(`Sent to ${result.recipientCount} account${result.recipientCount === 1 ? '' : 's'}.`)
      setTitle('')
      setBody('')
      setSeverity('critical')
    }
  }

  const canSend = title.trim().length > 0 && body.trim().length > 0

  return (
    <div>
      <PageHeader icon={Siren} title="Emergency Alerts" description="Send an urgent broadcast to every account on the platform -- disaster, safety incident, or anything that can't wait for a destination-scoped advisory." />

      <Card className="mb-6">
        <h2 className="mb-4 text-sm font-semibold text-ink">Compose a broadcast</h2>
        {sentNotice && <div className="mb-4"><Alert tone="success">{sentNotice}</Alert></div>}
        {sendError && <div className="mb-4"><Alert tone="error">{sendError}</Alert></div>}
        <div className="space-y-4">
          <FormField label="Title" hint="Short and specific -- this is the headline every account sees.">
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder="e.g. Flash flood warning -- Manali region" className={inputClass} />
          </FormField>
          <FormField label="Message">
            <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} rows={4} placeholder="What's happening, and what travellers/operators/workers should do right now." className={inputClass} />
          </FormField>
          <FormField label="Severity">
            <select value={severity} onChange={(e) => setSeverity(e.target.value)} className={inputClass}>
              {SEVERITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </FormField>
          <Button variant="danger" icon={Send} disabled={!canSend} onClick={() => setConfirming(true)}>
            Send to all accounts
          </Button>
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Active broadcasts</h2>
          <Badge tone="neutral">{activeAlerts.length}</Badge>
        </div>
        {resolveError && <div className="mb-4"><Alert tone="error">{resolveError}</Alert></div>}
        {error && <Alert tone="error">{error}</Alert>}
        {isLoading ? (
          <LoadingState label="Loading active broadcasts…" />
        ) : activeAlerts.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="Nothing active" description="No emergency broadcast is currently live. Sent alerts appear here until you mark them resolved." />
        ) : (
          <div className="space-y-2">
            {activeAlerts.map((a) => {
              const sev = alertSeverity(a.severity)
              return (
                <div key={a._id} className="rounded-lg border border-paper-dim px-3 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge tone={sev.tone}>{sev.label}</Badge>
                        <p className="font-medium text-ink">{a.title}</p>
                      </div>
                      <p className="mt-1 text-sm text-ink/70">{a.body}</p>
                      <p className="mt-1.5 text-xs text-ash">
                        Sent by {a.createdByName} to {a.recipientCount} accounts -- {new Date(a.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" loading={resolvingId === a._id} onClick={() => resolveBroadcast(a._id)}>
                      Mark resolved
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <Modal open={confirming} onClose={() => setConfirming(false)} title="Send this to every account?">
        <p className="text-sm text-ink/70">
          This emails and notifies <strong>every account on the platform</strong> immediately. This can't be undone, though you can mark it resolved afterwards.
        </p>
        <div className="mt-4 rounded-lg bg-paper-dim/50 p-3">
          <p className="text-sm font-semibold text-ink">{title}</p>
          <p className="mt-1 text-sm text-ink/70">{body}</p>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirming(false)}>Cancel</Button>
          <Button variant="danger" icon={Send} loading={isSending} onClick={handleConfirmSend}>Send now</Button>
        </div>
      </Modal>
    </div>
  )
}
