import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MapPin, Store, ArrowLeft, Download, Check, Plane, Train, Bus, Users, IndianRupee } from 'lucide-react'
import api, { getErrorMessage } from '../../lib/api'
import { getDestinationLabel, downloadEducationPack, readEducationPack } from '../../lib/destinations'
import PressureRing from '../pressure/PressureRing'
import PressureCard from '../pressure/PressureCard'
import { scoreLabel } from '../pressure/scoreColor'
import PageHeader from '../ui/PageHeader'
import Card from '../ui/Card'
import Button from '../ui/Button'
import Alert from '../ui/Alert'
import LoadingState from '../ui/LoadingState'
import { inputClass } from '../ui/FormField'

const today = () => new Date().toISOString().slice(0, 10)

// Destination Detail (frontend sitemap doc, Page 8) -- status PARTIAL. There
// is no dedicated "destination overview" route yet, so this renders exactly
// what GET /api/v1/pressure/:destId already returns (score, component
// breakdown, degraded/dropped honesty flags), plus the displayName lookup
// this app already keeps from the seed data. Not blocked on a new route --
// the doc is explicit that this is a nice-to-have refactor, not a hard
// blocker.
// One attr score (0-1) rendered as a short label, only when the seed
// actually carries a value for it -- never a fabricated "usually crowded
// in winter" sentence this data doesn't support.
const ATTR_LABELS = { snow: 'Snow', trek: 'Trekking', riverside: 'Riverside', heritage: 'Heritage', nightlife: 'Nightlife', food: 'Food', wildlife: 'Wildlife', spiritual: 'Spiritual' }

function EducationPackCard({ destId }) {
  const [pack, setPack] = useState(() => readEducationPack(destId))
  const [isDownloading, setIsDownloading] = useState(false)

  async function handleDownload() {
    setIsDownloading(true)
    const ok = await downloadEducationPack(destId)
    if (ok) setPack(readEducationPack(destId))
    setIsDownloading(false)
  }

  const topAttrs = pack
    ? Object.entries(pack.attrs || {}).filter(([, v]) => typeof v === 'number' && v >= 0.5).sort(([, a], [, b]) => b - a).slice(0, 3)
    : []

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">Travel Education pack</p>
          <p className="text-xs text-ash">Access, pricing, and destination facts -- saved to this device, readable with no connection.</p>
        </div>
        <Button variant={pack ? 'outline' : 'primary'} size="sm" icon={pack ? Check : Download} loading={isDownloading} onClick={handleDownload}>
          {pack ? 'Downloaded' : 'Download'}
        </Button>
      </div>

      {pack && (
        <div className="mt-4 space-y-3 border-t border-paper-dim pt-4">
          {topAttrs.length > 0 && (
            <p className="text-xs text-ash">Known for: {topAttrs.map(([k]) => ATTR_LABELS[k] || k).join(', ')}</p>
          )}
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {pack.nearestAirport && (
              <div><p className="flex items-center gap-1 text-xs text-ash"><Plane size={12} aria-hidden="true" /> Nearest airport</p><p className="mt-0.5 font-medium text-ink">{pack.nearestAirport}</p></div>
            )}
            {pack.nearestRailhead && (
              <div><p className="flex items-center gap-1 text-xs text-ash"><Train size={12} aria-hidden="true" /> Nearest railhead</p><p className="mt-0.5 font-medium text-ink">{pack.nearestRailhead}{pack.railheadDistanceKm ? ` (${pack.railheadDistanceKm} km)` : ''}</p></div>
            )}
            {pack.roadAccess?.corridor && (
              <div><p className="flex items-center gap-1 text-xs text-ash"><Bus size={12} aria-hidden="true" /> Road corridor</p><p className="mt-0.5 font-medium text-ink">{pack.roadAccess.corridor}</p></div>
            )}
            {pack.baseline?.hotelMedianINR != null && (
              <div><p className="flex items-center gap-1 text-xs text-ash"><IndianRupee size={12} aria-hidden="true" /> Median stay price</p><p className="mt-0.5 font-medium text-ink">₹{pack.baseline.hotelMedianINR}/night</p></div>
            )}
            {pack.baseline?.dailyVisitors != null && (
              <div><p className="flex items-center gap-1 text-xs text-ash"><Users size={12} aria-hidden="true" /> Daily visitors (baseline)</p><p className="mt-0.5 font-medium text-ink">{pack.baseline.dailyVisitors.toLocaleString('en-IN')}</p></div>
            )}
          </div>
          <p className="text-[11px] text-ash">Saved {new Date(pack.downloadedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })} -- these are structural facts, not today's live crowding.</p>
        </div>
      )}
    </Card>
  )
}

export default function DestinationDetail() {
  const { destId } = useParams()
  const [date, setDate] = useState(today())
  const [row, setRow] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function loadPressure() {
      setIsLoading(true)
      setError(null)
      try {
        const res = await api.get(`/v1/pressure/${destId}`, { params: { date } })
        if (!cancelled) setRow(res.data)
      } catch (err) {
        if (cancelled) return
        // A destination genuinely not tracked yet is a 404, not a fault --
        // show the same honest "unavailable" state either way (§8).
        setRow(null)
        setError(getErrorMessage(err, 'Pressure data unavailable for this date'))
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    loadPressure()
    return () => { cancelled = true }
  }, [destId, date])

  return (
    <div>
      <Link to="/explore" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-ink">
        <ArrowLeft size={14} aria-hidden="true" /> Back to explore
      </Link>

      <PageHeader icon={MapPin} title={getDestinationLabel(destId)} description="Current crowding reading and why the number is what it is." />

      <div className="mb-5 flex items-center gap-3">
        <label className="text-sm font-medium text-ink/80" htmlFor="detail-date">Date</label>
        <input id="detail-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${inputClass} w-auto`} />
      </div>

      {/* Independent of the pressure fetch below on purpose -- a downloaded
          pack still renders even if that live call fails or the device is
          offline entirely, which is the whole point of it. */}
      <div className="mb-4"><EducationPackCard key={destId} destId={destId} /></div>

      {isLoading ? (
        <LoadingState label="Reading pressure for this destination…" />
      ) : error ? (
        <Alert tone="error">{error}</Alert>
      ) : (
        <div className="space-y-4">
          <div className="isobar-canvas flex items-center gap-4 rounded-lg p-5">
            <PressureRing score={row?.score} variant={row?.score >= 0.6 ? 'requested' : 'alternative'} size={80} />
            <p className="text-sm text-paper/70">
              {row?.score == null ? (
                'Pressure data unavailable for this date.'
              ) : scoreLabel(row.score) === 'crowded' ? (
                'This destination is under pressure on this date -- worth checking alternatives.'
              ) : scoreLabel(row.score) === 'moderate' ? (
                'This destination has moderate crowding on this date.'
              ) : (
                'This destination is calm on this date.'
              )}
            </p>
          </div>

          <PressureCard row={row} />

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-ink">Local businesses here</p>
                <p className="text-xs text-ash">Homestays, guides, drivers, and cooks onboarded through the platform.</p>
              </div>
              <Link to={`/businesses?destId=${destId}`}>
                <Button variant="outline" icon={Store} size="sm">View</Button>
              </Link>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
