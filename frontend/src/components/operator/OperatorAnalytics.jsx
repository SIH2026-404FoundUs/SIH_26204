import { useEffect } from 'react'
import { BarChart3, Users, CalendarCheck, ShieldCheck, Clock3, Tag } from 'lucide-react'
import { useOperatorStore } from '../../store/useOperatorStore'
import PageHeader from '../ui/PageHeader'
import Card from '../ui/Card'
import EmptyState from '../ui/EmptyState'
import LoadingState from '../ui/LoadingState'
import Alert from '../ui/Alert'

const POLL_MS = 15_000 // same cadence as Waitlist & Offers, so every operator page stays in sync together

function StatCard({ icon: Icon, label, value }) {
  return (
    <Card padding="p-4">
      <div className="flex items-center gap-2 text-ash">
        <Icon size={14} aria-hidden="true" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-1.5 font-display text-2xl text-ink">{value}</p>
    </Card>
  )
}

// Real aggregate traveller activity across every business this operator
// owns (GET /v1/analytics/operator) -- bookings, visits, waitlist demand,
// and offer performance, all pulled from collections that already exist
// for other reasons (Booking, Visit, Waitlist, Offer). No per-traveller
// identity is ever shown here, only counts, same privacy posture as the
// waitlist/click-to-hire endpoints.
export default function OperatorAnalytics() {
  const { analytics, isLoadingAnalytics, analyticsError, fetchAnalytics } = useOperatorStore()

  useEffect(() => {
    fetchAnalytics()
    const interval = setInterval(fetchAnalytics, POLL_MS)
    return () => clearInterval(interval)
  }, [fetchAnalytics])

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader icon={BarChart3} title="Analytics" description="Real traveller activity across every business you've registered -- bookings, verified visits, waitlist demand, and offers." />

      {analyticsError && <Alert tone="error">{analyticsError}</Alert>}

      {isLoadingAnalytics && !analytics ? (
        <LoadingState label="Loading analytics…" />
      ) : !analytics || analytics.businesses.length === 0 ? (
        <EmptyState icon={BarChart3} title="Register a business first" description="Once you've registered a business, real traveller activity for it shows up here." />
      ) : (
        <>
          <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard icon={CalendarCheck} label="Total bookings" value={analytics.totals.bookings} />
            <StatCard icon={ShieldCheck} label="Confirmed bookings" value={analytics.totals.confirmedBookings} />
            <StatCard icon={Users} label="Distinct travellers" value={analytics.totals.distinctTravellers} />
            <StatCard icon={Clock3} label="Verified visits" value={analytics.totals.visits} />
            <StatCard icon={Users} label="Waitlist demand" value={analytics.totals.waitlistDemand} />
            <StatCard icon={Tag} label="Offers claimed" value={analytics.totals.offersClaimed} />
          </div>

          <h2 className="mb-3 text-sm font-semibold text-ink">By business</h2>
          <div className="space-y-3">
            {analytics.businesses.map((b) => (
              <Card key={b.businessId} padding="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-ink">{b.name}</p>
                  <span className="text-xs text-ash">{b.destId} · {b.type}</span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-paper-dim/50 p-2 sm:grid-cols-4">
                  <Metric label="Bookings" value={b.bookings.total} sub={`${b.bookings.confirmed} confirmed`} />
                  <Metric label="Travellers" value={b.distinctTravellers} sub="distinct" />
                  <Metric label="Visits" value={b.visits.total} sub={`${b.visits.last30Days} in 30d`} />
                  <Metric label="Waitlist" value={b.waitlistDemand} sub="waiting" />
                </div>

                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ash">
                  <span>Offers: {b.offers.total} total · {b.offers.open} open · {b.offers.claimed} claimed</span>
                  <span>Bookings: {b.bookings.pending} pending · {b.bookings.declined} declined · {b.bookings.cancelled} cancelled</span>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function Metric({ label, value, sub }) {
  return (
    <div className="flex flex-col items-center rounded-md bg-paper p-1.5 text-center">
      <span className="text-[11px] text-ash">{label}</span>
      <span className="mt-0.5 text-sm font-semibold text-ink">{value}</span>
      <span className="text-[10px] text-ash">{sub}</span>
    </div>
  )
}
