import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Tag, CheckCircle2 } from 'lucide-react'
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

// Replaces the old explicit "Travel Alerts" nav item, and now merges in
// offers and waitlist activity too (spec: "notifications must come to
// traveller for new offers, waitlist and alerts") -- three real feeds
// composed by useNotificationsStore (GET /v1/trips + /v1/alerts/for-trip
// for alerts, GET /v1/waitlist/notifications for offers/waitlist), nothing
// fabricated. Each entry renders differently by n.type.
function AlertCard({ n }) {
  const severity = alertSeverity(n.severity)
  return (
    <Card padding="p-4">
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
}

function OfferCard({ n }) {
  const offer = n.offer
  return (
    <Card padding="p-4">
      <div className="mb-1.5 flex items-center gap-2">
        <Badge tone="warning" icon={Tag}>Flash offer</Badge>
        {offer?.status && <span className="text-xs text-ash capitalize">{offer.status}</span>}
      </div>
      <p className="text-sm font-semibold text-ink">
        A flash offer opened up near {getDestinationLabel(n.destId)}
      </p>
      {offer ? (
        <p className="mt-1 text-sm text-ink/80">
          {offer.discountPct ? `${offer.discountPct}% off` : 'Discounted'} -- ₹{offer.effectivePrice ?? offer.originalPrice}
          {offer.date && ` for ${new Date(offer.date).toLocaleDateString()}`}
        </p>
      ) : (
        <p className="mt-1 text-sm text-ink/80">You were on the waitlist when this opened.</p>
      )}
      <p className="mt-2 text-xs text-ash">{new Date(n.sentAt).toLocaleString()}</p>
      <div className="mt-3">
        <Link to="/offers">
          <Button variant="outline" size="sm">View offers & waitlist</Button>
        </Link>
      </div>
    </Card>
  )
}

function WaitlistFulfilledCard({ n }) {
  return (
    <Card padding="p-4">
      <div className="mb-1.5 flex items-center gap-2">
        <Badge tone="success" icon={CheckCircle2}>Waitlist fulfilled</Badge>
      </div>
      <p className="text-sm font-semibold text-ink">You claimed an offer near {getDestinationLabel(n.destId)}</p>
      <p className="mt-1 text-sm text-ink/80">Your standing waitlist request here is now fulfilled.</p>
      <p className="mt-2 text-xs text-ash">{new Date(n.sentAt).toLocaleString()}</p>
      <div className="mt-3">
        <Link to="/offers">
          <Button variant="outline" size="sm">View offers & waitlist</Button>
        </Link>
      </div>
    </Card>
  )
}

export default function Notifications() {
  const { notifications, isLoading, error, fetchNotifications } = useNotificationsStore()

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader icon={Bell} title="Notifications" description="Verified alerts, offers, and waitlist updates for your trips -- all in one place." />

      {error && <div className="mb-4"><Alert tone="error">{error}</Alert></div>}

      {isLoading ? (
        <LoadingState label="Checking for updates on your trips…" />
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No updates right now"
          description="A verified alert for a trip you have planned, a flash offer matched to your waitlist, or a waitlist you've claimed will show up here."
        />
      ) : (
        <div className="space-y-3">
          {notifications.map((n) =>
            n.type === 'offer' ? (
              <OfferCard key={n.id} n={n} />
            ) : n.type === 'waitlist_fulfilled' ? (
              <WaitlistFulfilledCard key={n.id} n={n} />
            ) : (
              <AlertCard key={n.id} n={n} />
            )
          )}
        </div>
      )}
    </div>
  )
}
