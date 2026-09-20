import { useEffect, useMemo, useState } from 'react'
import {
  IndianRupee, TrendingUp, TrendingDown, Gauge, CalendarDays, LayoutDashboard,
  Tag, Package, Sparkles, Info, RefreshCw, Calculator, Flame, Wind, Minus,
} from 'lucide-react'
import { useOperatorStore } from '../../store/useOperatorStore'
import { useRevenueStore } from '../../store/useRevenueStore'
import PageHeader from '../ui/PageHeader'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Alert from '../ui/Alert'
import LoadingState from '../ui/LoadingState'
import EmptyState from '../ui/EmptyState'
import FormField, { inputClass } from '../ui/FormField'

const POLL_MS = 15_000 // matches every other operator page's live-data cadence
const today = () => new Date().toISOString().slice(0, 10)
const money = (v) => (v == null ? '—' : `₹${Math.round(v).toLocaleString('en-IN')}`)
const moneyCompact = (v) => (v == null ? '—' : v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : money(v))
const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`)
const shortDay = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short' })
const dayLabel = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })

// High demand is an OPPORTUNITY for revenue (raise price, protect
// inventory), not a warning -- the opposite semantic of "pressure" on the
// traveller-facing crowding pages, so this deliberately does not reuse
// PressureBadge/scoreColor's danger-for-high convention. Low demand is what
// actually needs the operator's attention here.
const DEMAND_BADGE_TONE = { high: 'success', medium: 'neutral', low: 'warning' }
const DEMAND_COLOR = { high: 'var(--color-relief)', medium: 'var(--color-ash)', low: 'var(--color-pressure)' }
const DEMAND_ICON = { high: Flame, medium: Wind, low: TrendingDown }
const REC_ICON = { price: IndianRupee, promotion: Tag, inventory: Package }
const REC_BORDER = { price: 'border-l-pressure', promotion: 'border-l-relief', inventory: 'border-l-ink/30' }

// Two tabs, same convention as the Authority Dashboard's own tab bar: the
// overview (KPIs, forecast, recommendations) is the day-to-day read, and the
// what-if simulator is a deliberate, occasional "let me experiment" tool --
// splitting it out keeps the overview from feeling crowded by a form and an
// interactive chart that most visits don't need.
const TABS = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'simulator', label: 'What-if simulator', icon: Calculator },
]

function KpiTile({ icon: Icon, label, value, sub, chip, delay = 0 }) {
  return (
    <Card padding="p-4" interactive className="card-enter" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-ash">{label}</span>
        <span className={`flex h-8 w-8 items-center justify-center rounded-full ${chip}`}><Icon size={15} aria-hidden="true" /></span>
      </div>
      <p className="mt-2 font-display text-2xl text-ink">{value}</p>
      {sub && <p className="mt-1 text-[11px] text-ash">{sub}</p>}
    </Card>
  )
}

// Every recommendation/forecast day carries its own `reasons` -- the
// dashboard spec's "Explainability" requirement made concrete: nothing here
// is a black box, every number traces back to real data (or an explicitly
// labelled assumption, when real history doesn't exist yet).
function ReasonsList({ reasons }) {
  if (!reasons?.length) return null
  return (
    <ul className="mt-2.5 space-y-1.5 border-t border-paper-dim pt-2.5">
      {reasons.map((r) => (
        <li key={r} className="flex items-start gap-1.5 text-[11px] leading-4 text-ink/60">
          <Info size={11} className="mt-0.5 shrink-0 text-ink/30" aria-hidden="true" /> {r}
        </li>
      ))}
    </ul>
  )
}

// A small ring gauge for the hero -- pure circle geometry (equal width/
// height, stroke-dasharray on a circle), so unlike a scaled rect/text chart
// it can never look skewed regardless of container size. Same idea as
// PressureRing.jsx elsewhere in this app, adapted for a filled percentage
// rather than a breathing indicator.
function OccupancyGauge({ value, size = 64 }) {
  const r = size / 2 - 5
  const c = 2 * Math.PI * r
  const filled = c * Math.max(0, Math.min(1, value ?? 0))
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" role="img" aria-label={`${Math.round((value ?? 0) * 100)}% occupied today`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={5} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-relief)" strokeWidth={5}
        strokeDasharray={`${filled} ${c - filled}`} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dasharray 700ms ease-out' }}
      />
      <text x="50%" y="51%" dominantBaseline="middle" textAnchor="middle" fontSize={size * 0.24} fontWeight={700} fill="white">{pct(value)}</text>
    </svg>
  )
}

// Plain flex/CSS bars, not a hand-scaled SVG -- a viewBox scaled to a
// container's actual pixel width with preserveAspectRatio="none" (this
// component's first draft) stretches every rect and glyph non-uniformly,
// which is exactly what reads as "crooked" text and lopsided bars. CSS
// heights have no such failure mode and animate for free.
function DemandForecastChart({ days, selectedDate, onSelect }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { const id = requestAnimationFrame(() => setMounted(true)); return () => cancelAnimationFrame(id) }, [])

  return (
    <div className="flex items-end gap-2 sm:gap-3">
      {days.map((d, i) => {
        const heightPct = Math.max(4, Math.round(d.forecastedOccupancy * 100))
        const selected = d.date === selectedDate
        return (
          <button
            key={d.date}
            type="button"
            onClick={() => onSelect(d.date)}
            className="group flex flex-1 flex-col items-center gap-1.5"
            aria-pressed={selected}
            aria-label={`${dayLabel(d.date)}: ${heightPct}% forecasted occupancy, ${d.demandLevel} demand`}
          >
            <span className={`font-mono text-xs font-bold tabular-nums transition-colors ${selected ? 'text-ink' : 'text-ink/50 group-hover:text-ink/80'}`}>{heightPct}%</span>
            <div className="flex h-28 w-full items-end rounded-lg bg-paper-dim/50 p-1">
              <div
                className={`w-full rounded-md transition-[height,opacity] duration-700 ease-out ${selected ? 'opacity-100' : 'opacity-45 group-hover:opacity-75'}`}
                style={{ height: mounted ? `${heightPct}%` : '0%', backgroundColor: DEMAND_COLOR[d.demandLevel], transitionDelay: `${i * 40}ms` }}
              />
            </div>
            <span className={`h-0.5 w-6 rounded-full transition-colors ${selected ? 'bg-ink' : 'bg-transparent'}`} />
            <span className={`text-xs font-semibold transition-colors ${selected ? 'text-ink' : 'text-ash group-hover:text-ink/70'}`}>{shortDay(d.date)}</span>
          </button>
        )
      })}
    </div>
  )
}

function DemandLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px] text-ash">
      {(['high', 'medium', 'low']).map((level) => (
        <span key={level} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: DEMAND_COLOR[level] }} />
          {level} demand
        </span>
      ))}
    </div>
  )
}

function ForecastDetail({ day }) {
  const Icon = DEMAND_ICON[day.demandLevel]
  return (
    <Card padding="p-4" className="card-enter border-l-4" style={{ borderLeftColor: DEMAND_COLOR[day.demandLevel] }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: `color-mix(in srgb, ${DEMAND_COLOR[day.demandLevel]} 15%, transparent)`, color: DEMAND_COLOR[day.demandLevel] }}>
            <Icon size={15} aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">{dayLabel(day.date)}</p>
            <div className="flex items-center gap-1.5">
              <Badge tone={DEMAND_BADGE_TONE[day.demandLevel]}>{day.demandLevel} demand</Badge>
              {day.isWeekend && <Badge tone="neutral">Weekend</Badge>}
              {day.lowConfidence && <Badge tone="neutral">Low confidence</Badge>}
            </div>
          </div>
        </div>
        <div className="flex gap-4 text-right">
          <div><p className="text-[10px] uppercase tracking-wide text-ash">Occupancy</p><p className="font-mono text-lg tabular-nums text-ink">{pct(day.forecastedOccupancy)}</p></div>
          <div><p className="text-[10px] uppercase tracking-wide text-ash">Revenue</p><p className="font-mono text-lg tabular-nums text-ink">{moneyCompact(day.expectedRevenueINR)}</p></div>
        </div>
      </div>
      <ReasonsList reasons={day.reasons} />
    </Card>
  )
}

function RecommendationCard({ rec, delay = 0 }) {
  const Icon = REC_ICON[rec.type] || Sparkles
  return (
    <Card padding="p-4" interactive className={`card-enter border-l-4 ${REC_BORDER[rec.type] || 'border-l-ink/30'}`} style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink/6 text-ink-soft">
          <Icon size={15} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wide text-ash">{dayLabel(rec.date)} · {rec.type}</p>
          <p className="mt-1 text-sm text-ink">{rec.action}</p>
          <ReasonsList reasons={rec.reasons} />
        </div>
      </div>
    </Card>
  )
}

// Revenue-vs-price curve for the simulator. Fixed real-unit viewBox (not a
// 0..100 "percentage" box) with the DEFAULT preserveAspectRatio (uniform
// "meet" scaling) and a container locked to the same aspect ratio via the
// `aspect-[]` utility -- the combination that keeps circles circular and
// text upright at any width, unlike this chart's first draft.
function SimulatorChart({ results, basePriceINR }) {
  if (!results || results.length < 2) return null
  const W = 600, H = 220, pad = 28
  const prices = results.map((r) => r.priceINR)
  const revenues = results.map((r) => r.expectedRevenueINR)
  const minP = Math.min(...prices), maxP = Math.max(...prices)
  const minR = Math.min(...revenues), maxR = Math.max(...revenues)
  const x = (p) => pad + (maxP === minP ? (W - 2 * pad) / 2 : ((p - minP) / (maxP - minP)) * (W - 2 * pad))
  const y = (r) => H - pad - (maxR === minR ? (H - 2 * pad) / 2 : ((r - minR) / (maxR - minR)) * (H - 2 * pad))
  const linePath = results.map((r, i) => `${i === 0 ? 'M' : 'L'} ${x(r.priceINR)} ${y(r.expectedRevenueINR)}`).join(' ')
  const areaPath = `${linePath} L ${x(prices[prices.length - 1])} ${H - pad} L ${x(prices[0])} ${H - pad} Z`
  const peak = results.reduce((a, b) => (b.expectedRevenueINR > a.expectedRevenueINR ? b : a))

  return (
    <div className="mt-5 aspect-[600/220] w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" role="img" aria-label="Expected revenue by price">
        <defs>
          <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-pressure)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--color-pressure)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((frac) => (
          <line key={frac} x1={pad} x2={W - pad} y1={pad + frac * (H - 2 * pad)} y2={pad + frac * (H - 2 * pad)} stroke="var(--color-paper-dim)" strokeWidth={1} />
        ))}
        <path d={areaPath} fill="url(#revenueFill)" stroke="none" />
        <path d={linePath} fill="none" stroke="var(--color-pressure)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {results.map((r) => {
          const isPeak = r.priceINR === peak.priceINR
          const isBase = r.priceINR === basePriceINR
          return (
            <g key={r.priceINR}>
              <circle cx={x(r.priceINR)} cy={y(r.expectedRevenueINR)} r={isPeak ? 5 : 3} fill={isPeak ? 'var(--color-relief)' : 'var(--color-pressure)'} stroke="var(--color-paper)" strokeWidth={1.5} />
              {isBase && <circle cx={x(r.priceINR)} cy={y(r.expectedRevenueINR)} r={9} fill="none" stroke="var(--color-ink)" strokeWidth={1.2} strokeDasharray="2 2" />}
              <text x={x(r.priceINR)} y={H - pad + 16} textAnchor="middle" fontSize={11} fill="var(--color-ash)">{money(r.priceINR)}</text>
            </g>
          )
        })}
        <text x={x(peak.priceINR)} y={y(peak.expectedRevenueINR) - 12} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--color-relief)">Best · {money(peak.expectedRevenueINR)}</text>
      </svg>
    </div>
  )
}

function WhatIfSimulator({ businessId, defaultDate, defaultPrice }) {
  const { simResult, isSimulating, simError, simulatePrices } = useRevenueStore()
  const [dateOverride, setDateOverride] = useState('')
  const [priceInput, setPriceInput] = useState('')
  const date = dateOverride || defaultDate

  const prices = useMemo(() => {
    if (priceInput.trim()) {
      return priceInput.split(',').map((p) => Number(p.trim())).filter((p) => Number.isFinite(p) && p >= 0)
    }
    if (!defaultPrice) return []
    return [0.8, 0.9, 1, 1.1, 1.2].map((mult) => Math.round((defaultPrice * mult) / 50) * 50)
  }, [priceInput, defaultPrice])

  const runSimulation = (e) => {
    e?.preventDefault()
    if (!date || prices.length === 0) return
    simulatePrices(businessId, { date, prices })
  }

  const bestPriceINR = simResult?.results?.length
    ? simResult.results.reduce((a, b) => (b.expectedRevenueINR > a.expectedRevenueINR ? b : a)).priceINR
    : null

  return (
    <Card>
      <div className="mb-1 flex items-center gap-2">
        <Calculator size={16} className="text-pressure" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-ink">What-if price simulator</h2>
      </div>
      <p className="mb-4 text-xs text-ash">Compare expected occupancy and revenue at different prices for one date, so you can see the trade-off before changing anything.</p>
      <form onSubmit={runSimulation} className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <FormField label="Date"><input type="date" value={date} min={today()} onChange={(e) => setDateOverride(e.target.value)} className={inputClass} /></FormField>
        <FormField label="Prices (INR)" optional hint="Comma-separated, or leave blank for a spread around the current price"><input value={priceInput} onChange={(e) => setPriceInput(e.target.value)} placeholder="e.g. 4000,4500,5000" className={inputClass} /></FormField>
        <div className="flex items-end"><Button type="submit" variant="primary" fullWidth loading={isSimulating} disabled={prices.length === 0}>Simulate</Button></div>
      </form>

      {simError && <Alert tone="error">{simError}</Alert>}
      {simResult?.error && <Alert tone="warning">{simResult.error}</Alert>}
      {simResult?.results?.length > 0 && (
        <div className="card-enter">
          <div className="overflow-x-auto rounded-lg border border-paper-dim">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-paper-dim/40 text-left text-[11px] uppercase tracking-wide text-ash">
                  <th className="px-3 py-2 font-semibold">Price</th>
                  <th className="px-3 py-2 font-semibold">Expected occupancy</th>
                  <th className="px-3 py-2 font-semibold">Expected revenue</th>
                </tr>
              </thead>
              <tbody>
                {simResult.results.map((r) => {
                  const isBase = r.priceINR === simResult.basePriceINR
                  const isBest = r.priceINR === bestPriceINR
                  return (
                    <tr key={r.priceINR} className={`border-t border-paper-dim ${isBase ? 'bg-ink/[0.03]' : ''}`}>
                      <td className="px-3 py-2 font-mono tabular-nums text-ink">
                        {money(r.priceINR)}
                        {isBase && <span className="ml-1.5 text-[10px] font-sans font-medium text-ash">current</span>}
                      </td>
                      <td className="px-3 py-2 font-mono tabular-nums text-ink">{pct(r.expectedOccupancy)}</td>
                      <td className="px-3 py-2">
                        <span className={`font-mono tabular-nums ${isBest ? 'font-bold text-relief' : 'text-ink'}`}>{money(r.expectedRevenueINR)}</span>
                        {isBest && <Badge tone="success" className="ml-2">Best</Badge>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <SimulatorChart results={simResult.results} basePriceINR={simResult.basePriceINR} />
        </div>
      )}
    </Card>
  )
}

// Operator Revenue Management System -- forecasts demand, occupancy and
// revenue for one of the operator's own businesses from real booking/
// availability history plus the platform's existing destination-pressure
// engine, and turns that into explainable price/promotion/inventory
// recommendations. The operator approves or ignores every suggestion --
// nothing here changes a price or availability row automatically (dashboard
// spec principle: "human-in-the-loop, no automatic price manipulation").
// Traveller- and authority-facing pages/routes are untouched by this file.
export default function RevenueDashboard() {
  const { myBusinesses, isLoadingBusinesses, fetchMyBusinesses } = useOperatorStore()
  const { dashboard, isLoadingDashboard, dashboardError, fetchDashboard } = useRevenueStore()
  const [selectedId, setSelectedId] = useState('')
  const [selectedDate, setSelectedDate] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const businessId = selectedId || myBusinesses[0]?._id || ''
  const business = myBusinesses.find((b) => b._id === businessId)

  useEffect(() => { fetchMyBusinesses() }, [fetchMyBusinesses])

  useEffect(() => {
    if (!businessId) return
    fetchDashboard(businessId)
    const interval = setInterval(() => fetchDashboard(businessId, { silent: true }), POLL_MS)
    return () => clearInterval(interval)
  }, [businessId, fetchDashboard])

  const t = dashboard?.today
  const activeDay = dashboard?.forecast.find((d) => d.date === (selectedDate || t?.date)) || dashboard?.forecast[0]

  return (
    <div className="mx-auto max-w-5xl pb-8">
      <PageHeader icon={IndianRupee} title="Revenue management" description="Forecast demand and get explainable price, promotion and inventory recommendations for your own businesses. You decide -- nothing here changes a price automatically." />

      {isLoadingBusinesses ? (
        <LoadingState label="Loading your businesses…" />
      ) : myBusinesses.length === 0 ? (
        <EmptyState icon={IndianRupee} title="Register a business first" description="Revenue intelligence is scoped to a business you own. Add one from Register Business to get started." />
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <FormField label="Business"><select value={businessId} onChange={(e) => { setSelectedId(e.target.value); setSelectedDate(null) }} className={`${inputClass} w-auto min-w-[220px]`}>{myBusinesses.map((b) => <option key={b._id} value={b._id}>{b.name} · {b.destId}</option>)}</select></FormField>
            <Button type="button" variant="outline" size="sm" icon={RefreshCw} onClick={() => fetchDashboard(businessId)}>Refresh</Button>
          </div>

          {dashboardError && <div className="mb-4"><Alert tone="error">{dashboardError}</Alert></div>}

          {isLoadingDashboard && !dashboard ? (
            <LoadingState label="Building your revenue picture…" />
          ) : !dashboard ? null : (
            <>
              <div className="mb-6 flex flex-wrap gap-1.5 rounded-lg border border-paper-dim bg-white p-1">
                {TABS.map((tabDef) => (
                  <button
                    key={tabDef.key}
                    type="button"
                    onClick={() => setActiveTab(tabDef.key)}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition ${
                      activeTab === tabDef.key ? 'bg-ink text-paper shadow-sm' : 'text-ink/70 hover:bg-ink/5'
                    }`}
                  >
                    <tabDef.icon size={15} aria-hidden="true" />
                    {tabDef.label}
                  </button>
                ))}
              </div>

              {activeTab === 'simulator' ? (
                <WhatIfSimulator businessId={businessId} defaultDate={t.date} defaultPrice={dashboard.forecast[0]?.declaredPriceINR} />
              ) : (
              <>
              {/* Hero strip -- the app's own "isobar canvas" topographic
                  texture (same dark ink surface used on auth screens and the
                  landing hero) instead of a flat panel, with a real
                  circle-geometry occupancy gauge that can't skew regardless
                  of container width. */}
              <div className="isobar-canvas card-enter mb-6 flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-xl px-5 py-4">
                <div className="flex items-center gap-4">
                  <OccupancyGauge value={t.occupancy} />
                  <div>
                    <p className="text-xs font-medium text-paper/50">{business?.name} · {business?.destId}</p>
                    <p className="font-display text-xl text-paper">{pct(t.occupancy)} occupied today</p>
                    <p className="mt-0.5 text-xs text-paper/60">{t.confirmedBookings} confirmed booking(s) · {t.availableUnits ?? '—'} of {t.totalUnits} units open</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-paper/10 px-3 py-1.5 text-xs font-medium text-paper/80">Demand index {t.demandIndex}/100</span>
                  <span className="flex items-center gap-1 rounded-full bg-relief/25 px-3 py-1.5 text-xs font-semibold text-paper">
                    <TrendingUp size={12} aria-hidden="true" /> {money(t.revenueINR)} today
                  </span>
                </div>
              </div>

              <div className="mb-8 grid grid-cols-3 gap-3">
                <KpiTile icon={Gauge} label="Occupancy" value={pct(t.occupancy)} sub={`${(t.totalUnits ?? 0) - (t.availableUnits ?? 0)} of ${t.totalUnits} units`} chip="bg-ink text-paper" delay={0} />
                <KpiTile icon={IndianRupee} label="ADR" value={money(t.adrINR)} sub="Average daily rate" chip="bg-relief/15 text-relief" delay={40} />
                <KpiTile icon={TrendingUp} label="RevPAR" value={money(t.revPARINR)} sub="Price × occupancy" chip="bg-relief/15 text-relief" delay={80} />
                <KpiTile icon={IndianRupee} label="Revenue today" value={moneyCompact(t.revenueINR)} sub={`${t.confirmedBookings} confirmed booking(s)`} chip="bg-pressure/15 text-pressure" delay={120} />
                <KpiTile icon={Sparkles} label="Demand index" value={`${t.demandIndex}/100`} sub="Pressure + occupancy blend" chip="bg-ink/8 text-ink-soft" delay={160} />
                <KpiTile icon={Package} label="Available units" value={t.availableUnits ?? '—'} sub={`of ${t.totalUnits} total`} chip="bg-paper-dim text-ink/70" delay={200} />
              </div>

              {dashboard.lowDemandAlerts.length > 0 && (
                <div className="mb-6">
                  <Alert tone="warning">
                    <span className="font-semibold">{dashboard.lowDemandAlerts.length} low-demand date{dashboard.lowDemandAlerts.length === 1 ? '' : 's'} ahead — </span>
                    <span className="inline-flex flex-wrap gap-1.5 align-middle">
                      {dashboard.lowDemandAlerts.map((d) => (
                        <button key={d.date} type="button" onClick={() => setSelectedDate(d.date)} className="rounded-full bg-pressure/10 px-2 py-0.5 text-xs font-medium text-pressure transition hover:bg-pressure/20">
                          {dayLabel(d.date)}
                        </button>
                      ))}
                    </span>
                  </Alert>
                </div>
              )}

              <Card className="mb-8">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><CalendarDays size={16} className="text-relief" aria-hidden="true" /> {dashboard.forecast.length}-day demand forecast</h2>
                  <DemandLegend />
                </div>
                <DemandForecastChart days={dashboard.forecast} selectedDate={activeDay?.date} onSelect={setSelectedDate} />
                <div className="mt-5">
                  {activeDay && <ForecastDetail key={activeDay.date} day={activeDay} />}
                </div>
              </Card>

              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink"><Sparkles size={16} className="text-pressure" aria-hidden="true" /> Recommendations across this window</h2>
              {dashboard.recommendations.length === 0 ? (
                <div className="mb-8"><EmptyState icon={Minus} title="Nothing to flag right now" description="Forecasted demand looks steady across this window -- no price, promotion or inventory changes suggested." /></div>
              ) : (
                <div className="mb-8 grid gap-3 sm:grid-cols-2">
                  {dashboard.recommendations.map((rec, idx) => <RecommendationCard key={`${rec.date}-${rec.type}-${idx}`} rec={rec} delay={idx * 50} />)}
                </div>
              )}
              </>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
