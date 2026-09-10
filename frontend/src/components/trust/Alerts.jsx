import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { TriangleAlert, Search } from 'lucide-react'
import { useTrustStore } from '../../store/useTrustStore'
import { alertSeverity, alertKindLabel } from '../../lib/labels'
import PageHeader from '../ui/PageHeader'
import Card from '../ui/Card'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import Alert from '../ui/Alert'
import EmptyState from '../ui/EmptyState'
import LoadingState from '../ui/LoadingState'
import FormField from '../ui/FormField'
import DestinationSelect from '../ui/DestinationSelect'

/** Sourced, current travel advisories -- always shown with where the information came from. */
export default function Alerts() {
  const { alerts, isLoadingAlerts, fetchAlerts, safetyError } = useTrustStore()
  const [searchParams] = useSearchParams()
  const [destId, setDestId] = useState(searchParams.get('destId') || 'manali')

  // Consistent with Businesses.jsx: show something real on first paint
  // rather than an empty state the user has to click "Check" to clear --
  // and, same as that page, honour a ?destId= deep link (Notifications'
  // "View details" links here for the destination the alert is actually about).
  useEffect(() => {
    fetchAlerts(destId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader icon={TriangleAlert} title="Travel alerts" description="Current, sourced advisories for a destination -- weather, road conditions, and access restrictions." />

      <form onSubmit={(e) => { e.preventDefault(); fetchAlerts(destId) }} className="mb-6 flex items-end gap-3">
        <div className="flex-1"><FormField label="Destination"><DestinationSelect value={destId} onChange={setDestId} /></FormField></div>
        <Button type="submit" variant="primary" icon={Search} loading={isLoadingAlerts}>Check</Button>
      </form>

      {safetyError && <div className="mb-4"><Alert tone="error">{safetyError}</Alert></div>}

      {isLoadingAlerts ? (
        <LoadingState label="Checking for active advisories…" />
      ) : alerts.length === 0 ? (
        <EmptyState title="No active advisories" description="Nothing on record for this destination right now." />
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const severity = alertSeverity(alert.severity)
            return (
              <Card key={alert._id} padding="p-4">
                <div className="mb-1.5 flex items-center gap-2">
                  <Badge tone={severity.tone}>{severity.label}</Badge>
                  <span className="text-xs text-ash">{alertKindLabel(alert.kind)}</span>
                </div>
                <p className="text-sm text-ink">{alert.body}</p>
                <p className="mt-2 text-xs text-ash">
                  Source: <a href={alert.sourceUrl} target="_blank" rel="noreferrer" className="text-pressure hover:underline">{alert.sourceName}</a>
                  {' · valid until '}{new Date(alert.validTo).toLocaleDateString()}
                </p>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
