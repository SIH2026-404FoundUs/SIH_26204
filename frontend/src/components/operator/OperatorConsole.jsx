import { useEffect, useState } from 'react'
import { CalendarDays, Check, Plus, Wrench, TrendingUp, MessageSquareText, RefreshCw, ThumbsUp, ThumbsDown } from 'lucide-react'
import PageHeader from '../ui/PageHeader'
import EmptyState from '../ui/EmptyState'
import Card from '../ui/Card'
import LoadingState from '../ui/LoadingState'
import Alert from '../ui/Alert'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import FormField, { inputClass } from '../ui/FormField'
import { useOperatorStore } from '../../store/useOperatorStore'

// Local Tourism Business Growth Platform (spec §3.4) -- the same
// growthRanking formula that already silently orders GET
// /v1/businesses/search results, surfaced here so an operator can see why
// they rank where they do instead of it working invisibly in the
// background of traveller search. Laid out as a narrow sidebar card (a
// single stacked list of factors, not a 3-up grid) since it now shares the
// page with the availability workflow instead of running the full width.
function GrowthInsightsCard({ businessId }) {
  const { growth, isLoadingGrowth, growthError, fetchGrowth } = useOperatorStore()
  useEffect(() => { if (businessId) fetchGrowth(businessId) }, [businessId, fetchGrowth])

  return (
    <Card padding="p-4">
      <div className="mb-3 flex items-center gap-2">
        <TrendingUp size={16} className="text-relief" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-ink">Growth insights</h2>
      </div>
      {isLoadingGrowth ? (
        <LoadingState label="Loading…" />
      ) : growthError ? (
        <Alert tone="error">{growthError}</Alert>
      ) : growth ? (
        <div className="space-y-3">
          <div>
            <span className="font-display text-2xl text-ink">{growth.rank.toFixed(2)}x</span>
            <p className="text-[11px] text-ash">visibility multiplier in search (1.00x is baseline)</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 rounded-lg border border-paper-dim px-2.5 py-2">
              <span className="text-[11px] font-medium text-ink/70">Local onboarding</span>
              <Badge tone={growth.factors.isLocallyOnboarded ? 'success' : 'neutral'}>
                {growth.factors.isLocallyOnboarded ? '+30%' : 'n/a'}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-paper-dim px-2.5 py-2">
              <span className="text-[11px] font-medium text-ink/70">Verification</span>
              <Badge tone={growth.factors.verificationTier === 'registered' ? 'success' : growth.factors.verificationTier === 'visit-verified' ? 'info' : 'neutral'}>
                {growth.factors.verificationTier}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-paper-dim px-2.5 py-2">
              <span className="text-[11px] font-medium text-ink/70">Redistribution</span>
              <Badge tone={growth.factors.isInLowPressureDest ? 'success' : 'neutral'}>
                {growth.factors.isInLowPressureDest ? '+25%' : 'inactive'}
              </Badge>
            </div>
          </div>
          {growth.nudges.length > 0 && (
            <div className="space-y-1.5 border-t border-paper-dim pt-3">
              {growth.nudges.map((n) => <p key={n} className="text-[11px] leading-4 text-ink/70">→ {n}</p>)}
            </div>
          )}
        </div>
      ) : null}
    </Card>
  )
}

// AI Tourist Feedback Intelligence (spec §3.2) -- themes/actions extracted
// from real traveller reviews left after a verified visit (VisitVerify.jsx).
// GET reads whatever's cached on the business; "Refresh with AI" re-runs
// the extraction (heuristic keyword extractor today -- no LLM endpoint is
// wired for this yet, themeSource always comes back honestly labeled).
function FeedbackInsightsCard({ businessId }) {
  const { feedbackInsights, isLoadingFeedbackInsights, feedbackInsightsError, isProcessingFeedback, fetchFeedbackInsights, reprocessFeedback } = useOperatorStore()
  useEffect(() => { if (businessId) fetchFeedbackInsights(businessId) }, [businessId, fetchFeedbackInsights])

  const insights = feedbackInsights

  return (
    <Card padding="p-4">
      <div className="mb-3 flex items-center gap-2">
        <MessageSquareText size={16} className="text-relief" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-ink">Feedback insights</h2>
      </div>

      {isLoadingFeedbackInsights ? (
        <LoadingState label="Loading…" />
      ) : feedbackInsightsError ? (
        <Alert tone="error">{feedbackInsightsError}</Alert>
      ) : !insights || insights.totalReviews === 0 ? (
        <EmptyState icon={MessageSquareText} title="No feedback yet" description="Reviews left after a verified visit show up here." />
      ) : !insights.meetsThreshold ? (
        <EmptyState
          icon={MessageSquareText}
          title={`${insights.totalReviews} of 5 reviews`}
          description={`Average so far: ${insights.averageRating} ★. Unlocks at 5 reviews.`}
        />
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="font-display text-2xl text-ink">{insights.averageRating} ★</span>
              <p className="text-[11px] text-ash">across {insights.totalReviews} reviews</p>
            </div>
            <Button type="button" variant="outline" size="sm" icon={RefreshCw} loading={isProcessingFeedback} onClick={() => reprocessFeedback(businessId)}>
              Refresh
            </Button>
          </div>

          {insights.themes.length === 0 ? (
            <p className="text-[11px] text-ash">No theme mentioned often enough yet (needs 3+ reviews).</p>
          ) : (
            <div className="space-y-1.5">
              {insights.themes.map((t) => (
                <div key={t.theme} className="flex items-center justify-between gap-2 rounded-lg border border-paper-dim px-2.5 py-2">
                  <p className="truncate text-[11px] font-medium text-ink">{t.theme}</p>
                  <Badge tone={t.sentiment === 'positive' ? 'success' : 'danger'} icon={t.sentiment === 'positive' ? ThumbsUp : ThumbsDown}>
                    {t.mentions}
                  </Badge>
                </div>
              ))}
            </div>
          )}

          {insights.actions.length > 0 && (
            <div className="space-y-1.5 border-t border-paper-dim pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-ash">Suggested actions</p>
              {insights.actions.map((a) => (
                <p key={a.action} className="text-[11px] leading-4 text-ink/70">→ {a.action}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

export default function OperatorConsole() {
  const { myBusinesses, isLoadingBusinesses, fetchMyBusinesses, availability, isLoadingAvailability, availabilityError, isSavingAvailability, fetchAvailability, saveAvailability } = useOperatorStore()
  const [selectedId, setSelectedId] = useState('')
  const [form, setForm] = useState({ date: '', units: '', available: '', pricePerNight: '', discountPct: '0' })
  const [saved, setSaved] = useState(false)
  const businessId = selectedId || myBusinesses[0]?._id || ''
  const business = myBusinesses.find((item) => item._id === businessId)

  useEffect(() => { fetchMyBusinesses() }, [fetchMyBusinesses])
  useEffect(() => { if (businessId) fetchAvailability(businessId) }, [businessId, fetchAvailability])

  async function submit(e) {
    e.preventDefault(); setSaved(false)
    const ok = await saveAvailability(businessId, { ...form, units: Number(form.units), available: form.available === '' ? Number(form.units) : Number(form.available), pricePerNight: form.pricePerNight === '' ? undefined : Number(form.pricePerNight), discountPct: Number(form.discountPct) || 0 })
    if (ok) { setSaved(true); setForm({ date: '', units: '', available: '', pricePerNight: '', discountPct: '0' }) }
  }

  return <div className="mx-auto max-w-5xl">
    <PageHeader icon={Wrench} title="Operator console" description="Declare your open inventory, pricing, and discounts so travellers can make informed booking requests." />
    {isLoadingBusinesses ? <LoadingState label="Loading your businesses..." /> : myBusinesses.length === 0 ? <EmptyState icon={Wrench} title="Register a business first" description="Your availability is attached to a registered listing. Add one from Register business to start accepting booking requests." /> : <>
      <FormField label="Business"><select value={businessId} onChange={(e) => setSelectedId(e.target.value)} className={`${inputClass} mb-6`}>{myBusinesses.map((b) => <option key={b._id} value={b._id}>{b.name} · {b.destId}</option>)}</select></FormField>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        <div>
          <Card className="mb-6"><div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="font-display text-lg text-ink">Add open dates</h2><p className="mt-1 text-xs text-ash">Declare inventory you can actually honour. Saving the same date updates its declaration.</p></div><CalendarDays size={22} className="text-relief" aria-hidden="true" /></div>
            <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Date"><input type="date" min={new Date().toISOString().slice(0, 10)} value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} required className={inputClass} /></FormField>
              <FormField label={business?.type === 'restaurant' ? 'Tables total' : 'Units total'}><input type="number" min="0" value={form.units} onChange={(e) => setForm((p) => ({ ...p, units: e.target.value }))} required className={inputClass} /></FormField>
              <FormField label="Bookable now" optional hint="Defaults to total units"><input type="number" min="0" value={form.available} onChange={(e) => setForm((p) => ({ ...p, available: e.target.value }))} className={inputClass} /></FormField>
              <FormField label="Price (INR)" optional><input type="number" min="0" value={form.pricePerNight} onChange={(e) => setForm((p) => ({ ...p, pricePerNight: e.target.value }))} className={inputClass} /></FormField>
              <FormField label="Discount %" optional hint="Maximum 40%"><input type="number" min="0" max="40" value={form.discountPct} onChange={(e) => setForm((p) => ({ ...p, discountPct: e.target.value }))} className={inputClass} /></FormField>
              <div className="flex items-end"><Button type="submit" icon={Plus} loading={isSavingAvailability} fullWidth>Save date</Button></div>
            </form>
          </Card>
          {availabilityError && <div className="mb-4"><Alert tone="error">{availabilityError}</Alert></div>}
          {saved && <div className="mb-4"><Alert tone="success">Availability saved. Travellers will see this date when bookable units are available.</Alert></div>}
          <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold text-ink">Upcoming availability</h2><Badge tone="info">{availability.length} date{availability.length === 1 ? '' : 's'}</Badge></div>
          {isLoadingAvailability ? <LoadingState label="Loading declared dates..." /> : availability.length === 0 ? <EmptyState icon={CalendarDays} title="No dates declared" description="Add an open date above when you know how many units you can honour." /> : <div className="space-y-2">{availability.map((row) => <Card key={row._id} padding="p-4"><div className="flex items-center justify-between gap-4"><div><p className="font-medium text-ink">{new Date(row.date).toLocaleDateString(undefined, { dateStyle: 'medium' })}</p><p className="mt-1 text-xs text-ash">{row.units.available} of {row.units.total} bookable · {row.pricePerNight ? `INR ${row.pricePerNight}` : 'price on request'}{row.discountPct ? ` · ${row.discountPct}% off` : ''}</p></div><Badge tone={row.isOpen && row.units.available > 0 ? 'success' : 'warning'} icon={row.isOpen && row.units.available > 0 ? Check : undefined}>{row.isOpen && row.units.available > 0 ? 'Open' : 'Closed'}</Badge></div></Card>)}</div>}
        </div>

        <aside className="space-y-4">
          <GrowthInsightsCard businessId={businessId} />
          <FeedbackInsightsCard businessId={businessId} />
        </aside>
      </div>
    </>}
  </div>
}
