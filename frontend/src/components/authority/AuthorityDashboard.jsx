import { useEffect } from 'react'
import { Landmark, RotateCw } from 'lucide-react'
import { useAuthorityDashboardStore } from '../../store/useAuthorityDashboardStore'
import PageHeader from '../ui/PageHeader'
import { inputClass } from '../ui/FormField'
import PressureSection from './PressureSection'
import CapacityGapTable from './CapacityGapTable'
import RedistributionImpact from './RedistributionImpact'
import AcceptanceRate from './AcceptanceRate'

// Authority Dashboard -- exactly four analytical sections (dashboard spec):
// pressure heatmap, capacity gap, redistribution impact, acceptance rate.
// Reached only via /authority, itself wrapped in <RequireRole role="authority">
// (App.jsx) -- that's a UX convenience, not the real gate. Every API call
// this page makes goes through GET /api/v1/dashboard/*, which independently
// checks req.user.role === "authority" server-side (dashboard.route.js) --
// a traveller or operator account gets 403 from the backend regardless of
// what the frontend would have rendered.
export default function AuthorityDashboard() {
  const date = useAuthorityDashboardStore((s) => s.date)
  const setDate = useAuthorityDashboardStore((s) => s.setDate)
  const fetchAll = useAuthorityDashboardStore((s) => s.fetchAll)

  const pressure = useAuthorityDashboardStore((s) => s.pressure)
  const isLoadingPressure = useAuthorityDashboardStore((s) => s.isLoadingPressure)
  const pressureError = useAuthorityDashboardStore((s) => s.pressureError)

  const capacity = useAuthorityDashboardStore((s) => s.capacity)
  const isLoadingCapacity = useAuthorityDashboardStore((s) => s.isLoadingCapacity)
  const capacityError = useAuthorityDashboardStore((s) => s.capacityError)

  const redistribution = useAuthorityDashboardStore((s) => s.redistribution)
  const isLoadingRedistribution = useAuthorityDashboardStore((s) => s.isLoadingRedistribution)
  const redistributionError = useAuthorityDashboardStore((s) => s.redistributionError)

  const acceptance = useAuthorityDashboardStore((s) => s.acceptance)
  const isLoadingAcceptance = useAuthorityDashboardStore((s) => s.isLoadingAcceptance)
  const acceptanceError = useAuthorityDashboardStore((s) => s.acceptanceError)

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  return (
    <div>
      <PageHeader
        icon={Landmark}
        title="Authority dashboard"
        description="Destination pressure across the network, and how much of it the platform has actually redistributed."
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <label htmlFor="dashboard-date" className="text-sm font-medium text-ink/80">Date</label>
        <input
          id="dashboard-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={`${inputClass} w-auto`}
        />
        <span className="text-xs text-ash">Applies to the pressure heatmap and capacity gap below -- redistribution and acceptance reflect all trips regardless of date.</span>
        <button
          type="button"
          onClick={fetchAll}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-paper-dim bg-white px-3 py-2 text-xs font-medium text-ink/70 transition hover:border-ink/40"
          title="Refresh all sections"
        >
          <RotateCw size={14} aria-hidden="true" />
          Refresh
        </button>
      </div>

      <PressureSection data={pressure} isLoading={isLoadingPressure} error={pressureError} date={date} />
      <CapacityGapTable data={capacity} isLoading={isLoadingCapacity} error={capacityError} />
      <RedistributionImpact data={redistribution} isLoading={isLoadingRedistribution} error={redistributionError} />
      <AcceptanceRate data={acceptance} isLoading={isLoadingAcceptance} error={acceptanceError} />
    </div>
  )
}
