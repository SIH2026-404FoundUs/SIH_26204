import { useEffect, useState } from 'react'
import { Landmark, RotateCw, Flame, Gauge, ArrowLeftRight, CheckCircle2 } from 'lucide-react'
import { useAuthorityDashboardStore } from '../../../store/useAuthorityDashboardStore'
import PageHeader from '../../ui/PageHeader'
import TabBar from '../../ui/TabBar'
import Button from '../../ui/Button'
import { inputClass } from '../../ui/FormField'
import PressureSection from './PressureSection'
import CapacityGapTable from './CapacityGapTable'
import RedistributionImpact from './RedistributionImpact'
import AcceptanceRate from './AcceptanceRate'

// The four analytical sections the dashboard spec calls for, as tabs
// instead of one long stacked page. All four fetch together on load/
// refresh (fetchAll) so switching between them never shows a stale
// spinner. Complaints used to be a fifth tab here -- moved to its own
// workspace destination (AuthorityComplaints.jsx, /authority/complaints)
// now that travellers, operators, and workers all file into the same
// queue; it's a standing moderation workload, not a dashboard section.
const TABS = [
  { key: 'pressure', label: 'Destination Pressure Heatmap', icon: Flame },
  { key: 'capacity', label: 'Capacity Gap', icon: Gauge },
  { key: 'redistribution', label: 'Redistribution Impact', icon: ArrowLeftRight },
  { key: 'acceptance', label: 'Acceptance Rate', icon: CheckCircle2 },
]

// Authority Dashboard -- exactly four analytical sections (dashboard spec):
// pressure heatmap, capacity gap, redistribution impact, acceptance rate.
// Reached only via /authority, itself wrapped in <RequireRole role="authority">
// (App.jsx) -- that's a UX convenience, not the real gate. Every API call
// this page makes goes through GET /api/v1/dashboard/*, which independently
// checks req.user.role === "authority" server-side (dashboard.route.js) --
// a traveller or operator account gets 403 from the backend regardless of
// what the frontend would have rendered.
// Polled, not fetched once: a traveller booking, joining a waitlist, or
// getting redirected to a calmer destination all change these numbers
// while an authority has this dashboard open. Same 15s cadence as the
// operator/traveller pages this mirrors.
const POLL_MS = 15_000

export default function AuthorityDashboard() {
  const [activeTab, setActiveTab] = useState('pressure')
  const [lastSyncedAt, setLastSyncedAt] = useState(null)
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
    fetchAll().then(() => setLastSyncedAt(new Date()))
    const interval = setInterval(() => {
      fetchAll({ silent: true }).then(() => setLastSyncedAt(new Date()))
    }, POLL_MS)
    return () => clearInterval(interval)
  }, [fetchAll])

  function handleManualRefresh() {
    fetchAll().then(() => setLastSyncedAt(new Date()))
  }

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
        <Button
          variant="secondary"
          size="sm"
          icon={RotateCw}
          onClick={handleManualRefresh}
          className="ml-auto"
          title="Refresh all sections"
        >
          Refresh
        </Button>
      </div>
      {lastSyncedAt && (
        <p className="-mt-4 mb-6 text-xs text-ash">Live -- updates automatically every 15s. Last synced {lastSyncedAt.toLocaleTimeString()}.</p>
      )}

      <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {activeTab === 'pressure' && (
        <PressureSection data={pressure} isLoading={isLoadingPressure} error={pressureError} date={date} />
      )}
      {activeTab === 'capacity' && (
        <CapacityGapTable data={capacity} isLoading={isLoadingCapacity} error={capacityError} />
      )}
      {activeTab === 'redistribution' && (
        <RedistributionImpact data={redistribution} isLoading={isLoadingRedistribution} error={redistributionError} />
      )}
      {activeTab === 'acceptance' && (
        <AcceptanceRate data={acceptance} isLoading={isLoadingAcceptance} error={acceptanceError} />
      )}
    </div>
  )
}
