import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Compass, ChevronRight } from 'lucide-react'
import { useTripsStore } from '../../store/useTripsStore'
import Card from '../ui/Card'

// Same stat computation MyTrips.jsx's own header cards already use (real
// data, GET /v1/trips) -- travellers already had a substantive Profile
// (account + travel preferences), this closes the one remaining gap: no
// sign anywhere on the account page of how much you've actually used the
// platform.
export default function TravellerTripsCard() {
  const { trips, fetchMyTrips } = useTripsStore()

  useEffect(() => { fetchMyTrips() }, [fetchMyTrips])

  const stats = useMemo(() => ({
    total: trips.length,
    redirected: trips.filter((trip) => trip.redistribution?.kind && trip.redistribution.kind !== 'none').length,
    savings: trips.reduce((sum, trip) => sum + Number(trip.redistribution?.savingINR || 0), 0),
  }), [trips])

  if (trips.length === 0) return null

  return (
    <Card className="mb-4">
      <div className="mb-3 flex items-center gap-2">
        <Compass size={16} className="text-relief" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-ink">Your trips</h2>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div><p className="font-display text-lg text-ink">{stats.total}</p><p className="text-[10px] uppercase tracking-wide text-ash">Total trips</p></div>
        <div><p className="font-display text-lg text-ink">{stats.redirected}</p><p className="text-[10px] uppercase tracking-wide text-ash">Redistributed</p></div>
        <div><p className="font-display text-lg text-relief">₹{stats.savings.toLocaleString('en-IN')}</p><p className="text-[10px] uppercase tracking-wide text-ash">Saved</p></div>
      </div>
      <Link to="/trips" className="mt-3 flex items-center gap-1 text-xs font-medium text-ink/60 hover:text-ink">
        View all trips <ChevronRight size={12} aria-hidden="true" />
      </Link>
    </Card>
  )
}
