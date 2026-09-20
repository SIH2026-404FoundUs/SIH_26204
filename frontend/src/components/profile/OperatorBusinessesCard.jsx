import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Store, ChevronRight, Plus } from 'lucide-react'
import { useOperatorStore } from '../../store/useOperatorStore'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import LoadingState from '../ui/LoadingState'

// What was missing from an operator's Profile before this: any sign at all
// that they run a business, or how it's actually doing. This is real, live
// data -- the businesses list (GET /v1/businesses/mine) and the aggregate
// totals (GET /v1/analytics/operator, the exact same numbers
// OperatorAnalytics.jsx's own page shows) -- not a duplicate management
// form; editing a listing still happens at Register Business/Operator
// Console, this answers "what do I have, and how is it doing" right on
// the account page.
export default function OperatorBusinessesCard() {
  const { myBusinesses, isLoadingBusinesses, fetchMyBusinesses, analytics, isLoadingAnalytics, fetchAnalytics } = useOperatorStore()

  useEffect(() => {
    fetchMyBusinesses()
    fetchAnalytics()
  }, [fetchMyBusinesses, fetchAnalytics])

  return (
    <Card className="mb-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Store size={16} className="text-relief" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-ink">Your businesses</h2>
        </div>
        <Link to="/register-business"><Button variant="ghost" size="sm" icon={Plus}>Register another</Button></Link>
      </div>

      {isLoadingBusinesses ? (
        <LoadingState label="Loading…" />
      ) : myBusinesses.length === 0 ? (
        <p className="text-sm text-ink/50">Nothing registered yet -- <Link to="/register-business" className="font-medium text-pressure hover:underline">register your first business</Link>.</p>
      ) : (
        <>
          <div className="space-y-2">
            {myBusinesses.map((b) => (
              <div key={b._id} className="flex items-center justify-between rounded-lg border border-paper-dim px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-ink">{b.name}</p>
                  <p className="text-xs text-ash">{b.destId} · capacity {b.capacity ?? '—'}</p>
                </div>
                <Badge tone={b.verificationTier === 'registered' ? 'success' : b.verificationTier === 'visit-verified' ? 'info' : 'neutral'}>{b.verificationTier || 'self-declared'}</Badge>
              </div>
            ))}
          </div>

          {!isLoadingAnalytics && analytics && (
            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-paper-dim pt-4 sm:grid-cols-6">
              {[
                ['Bookings', analytics.totals.bookings],
                ['Confirmed', analytics.totals.confirmedBookings],
                ['Travellers', analytics.totals.distinctTravellers],
                ['Visits', analytics.totals.visits],
                ['Waitlisted', analytics.totals.waitlistDemand],
                ['Offers claimed', analytics.totals.offersClaimed],
              ].map(([label, value]) => (
                <div key={label} className="text-center">
                  <p className="font-display text-lg text-ink">{value}</p>
                  <p className="text-[10px] uppercase tracking-wide text-ash">{label}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <Link to="/operator" className="mt-3 flex items-center gap-1 text-xs font-medium text-ink/60 hover:text-ink">
        Manage inventory & pricing in Operator Console <ChevronRight size={12} aria-hidden="true" />
      </Link>
    </Card>
  )
}
