import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useNotificationsStore } from '../../store/useNotificationsStore'
import { getDestinationLabel } from '../../lib/destinations'
import { alertSeverity, alertKindLabel } from '../../lib/labels'
import PageHeader from '../ui/PageHeader'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Alert from '../ui/Alert'
import LoadingState from '../ui/LoadingState'
import EmptyState from '../ui/EmptyState'

// Replaces the old explicit "Travel Alerts" nav item. Same verified-alert
// data (useNotificationsStore composes GET /api/v1/trips + GET
// /api/v1/alerts, nothing new on the backend) -- filtered to only what's
// relevant to a trip this traveller actually has planned, for dates that
// actually overlap. Never every alert for every destination.
export default function Notifications() {
  const { notifications, isLoading, error, fetchNotifications } = useNotificationsStore()

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader icon={Bell} title="Notifications" description="Verified updates for the destinations and dates you actually have planned." />

      {error && <div className="mb-4"><Alert tone="error">{error}</Alert></div>}

      {isLoading ? (
        <LoadingState label="Checking for updates on your trips…" />
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No updates right now"
          description="If a verified alert is reported for a destination and dates you have a trip planned for, it'll show up here."
        />
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const severity = alertSeverity(n.severity)
            return (
              <Card key={n.id} padding="p-4">
                <div className="mb-1.5 flex items-center gap-2">
                  <Badge tone={severity.tone}>{severity.label}</Badge>
                  <span className="text-xs text-ash">{alertKindLabel(n.kind)}</span>
                </div>
                <p className="text-sm font-semibold text-ink">Update for your {getDestinationLabel(n.destId)} trip</p>
                <p className="mt-1 text-sm text-ink/80">{n.body}</p>
                <p className="mt-2 text-xs text-ash">
                  Your trip: {n.tripDates?.startDate}{n.tripDates?.endDate ? ` – ${n.tripDates.endDate}` : ''}
                  {' · Source: '}<a href={n.sourceUrl} target="_blank" rel="noreferrer" className="text-pressure hover:underline">{n.sourceName}</a>
                </p>
                <div className="mt-3">
                  <Link to={`/alerts?destId=${n.destId}`}>
                    <Button variant="outline" size="sm">View details</Button>
                  </Link>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
