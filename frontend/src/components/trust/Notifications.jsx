import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Tag, CheckCircle2, X } from 'lucide-react'
import { useNotificationsStore } from '../../store/useNotificationsStore'
import { useTrustStore } from '../../store/useTrustStore'
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

// Accept reuses the existing atomic-claim endpoint (POST /v1/offers/:id/
// claim, same one the Offers & Waitlist page uses) -- winning is still
// first-come-first-served across every waitlisted traveller, this button
// just lets that happen from the notification itself instead of requiring
// a trip to another page first. Reject is the other half (spec: "they must
// accept that offer or reject") -- it doesn't touch the shared offer at
// all, only this traveller's own waitlist entry: POST /v1/waitlist/:id/
// decline stamps this one notification "declined" (so the buttons don't
// come back for it) and starts a 7-day re-notify ban for that destination.
function OfferCard({ n, onRespond }) {
  const offer = n.offer
  const [busy, setBusy] = useState(null) // 'accept' | 'reject' | null

  async function handle(action) {
    setBusy(action)
    await onRespond(action, n)
    setBusy(null)
  }

  const isOpen = offer?.status === 'open'
  const alreadyDeclined = n.response === 'declined'
  const showActions = isOpen && !alreadyDeclined

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

      {showActions ? (
        <div className="mt-3 flex items-center gap-2">
          <Button variant="relief" size="sm" loading={busy === 'accept'} disabled={busy !== null} onClick={() => handle('accept')}>
            Accept
          </Button>
          <Button variant="outline" size="sm" icon={X} loading={busy === 'reject'} disabled={busy !== null} onClick={() => handle('reject')}>
            Reject
          </Button>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-3">
          {alreadyDeclined && <span className="text-xs font-medium text-ash">You declined this offer.</span>}
          {!isOpen && offer && <span className="text-xs font-medium text-ash">{offer.status === 'claimed' ? 'This offer has been claimed.' : 'This offer has expired.'}</span>}
          <Link to="/offers">
            <Button variant="outline" size="sm">View offers & waitlist</Button>
          </Link>
        </div>
      )}
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
  const { claimOffer, declineOfferNotification, marketError } = useTrustStore()

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  async function handleRespond(action, n) {
    if (action === 'accept') {
      await claimOffer(n.offerId)
    } else {
      await declineOfferNotification(n.waitlistId, n.offerId)
    }
    fetchNotifications() // re-fetch so this card (and any waitlist_fulfilled it produced) reflects the real outcome
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader icon={Bell} title="Notifications" description="Verified alerts, offers, and waitlist updates for your trips -- all in one place." />

      {(error || marketError) && <div className="mb-4"><Alert tone="error">{error || marketError}</Alert></div>}

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
              <OfferCard key={n.id} n={n} onRespond={handleRespond} />
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
