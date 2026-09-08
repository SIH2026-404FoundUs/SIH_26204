import { useLocation, Link } from 'react-router-dom'
import { CheckCircle2, TriangleAlert, ArrowLeft } from 'lucide-react'
import Card from '../ui/Card'
import Button from '../ui/Button'
import { getDestinationLabel } from '../../lib/destinations'

function formatDate(dateString) {
  if (!dateString) return 'the selected date'
  const parsed = new Date(dateString)
  if (Number.isNaN(parsed.getTime())) return dateString
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function TripConfirmation() {
  const { state = {} } = useLocation()
  const { type = 'decline', requested = {}, selected = {} } = state

  const requestedName = requested.displayName || getDestinationLabel(requested.destId)
  const requestedPressure = typeof requested.pressure === 'number' ? requested.pressure : 0.8
  const reqPressurePercent = Math.round(requestedPressure * 100)

  return (
    <main className="flex-1 bg-paper px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <Link to="/swap" className="inline-flex items-center gap-1.5 text-sm font-medium text-pressure hover:underline">
          <ArrowLeft size={16} aria-hidden="true" />
          Back to crowding check
        </Link>

        {type === 'place' && (() => {
          const selectedName = selected.displayName || getDestinationLabel(selected.destId)
          const selectedPressure = selected.pressure ?? 0.5
          return (
            <Card className="text-center" padding="p-8">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-relief/10 text-relief">
                <CheckCircle2 size={28} aria-hidden="true" />
              </span>
              <h1 className="mt-4 text-xl font-semibold text-ink">Destination changed</h1>
              <p className="mt-2 text-sm text-ash">
                Switched from <span className="text-ink/80 line-through">{requestedName}</span> to <strong className="text-ink">{selectedName}</strong>.
              </p>
              <dl className="mt-6 grid grid-cols-2 gap-4 text-left sm:grid-cols-3">
                <div className="rounded-xl bg-paper p-3">
                  <dt className="text-xs text-ash">Crowding, was</dt>
                  <dd className="mt-0.5 font-semibold text-ink">{reqPressurePercent}%</dd>
                </div>
                <div className="rounded-xl bg-paper p-3">
                  <dt className="text-xs text-ash">Crowding, now</dt>
                  <dd className="mt-0.5 font-semibold text-relief">{Math.round(selectedPressure * 100)}%</dd>
                </div>
                {selected.savingINR > 0 && (
                  <div className="rounded-xl bg-paper p-3">
                    <dt className="text-xs text-ash">Estimated savings</dt>
                    <dd className="mt-0.5 font-semibold text-ink">₹{selected.savingINR.toLocaleString('en-IN')}</dd>
                  </div>
                )}
              </dl>
              <Link to="/swap"><Button variant="primary" className="mt-6">Check another trip</Button></Link>
            </Card>
          )
        })()}

        {type === 'date' && (
          <Card className="text-center" padding="p-8">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-relief/10 text-relief">
              <CheckCircle2 size={28} aria-hidden="true" />
            </span>
            <h1 className="mt-4 text-xl font-semibold text-ink">Trip date moved</h1>
            <p className="mt-2 text-sm text-ash">
              <strong className="text-ink">{requestedName}</strong>, now on <strong className="text-ink">{formatDate(selected.startDate)}</strong>.
            </p>
            <dl className="mt-6 grid grid-cols-2 gap-4 text-left">
              <div className="rounded-xl bg-paper p-3">
                <dt className="text-xs text-ash">Crowding, was</dt>
                <dd className="mt-0.5 font-semibold text-ink">{reqPressurePercent}%</dd>
              </div>
              <div className="rounded-xl bg-paper p-3">
                <dt className="text-xs text-ash">Crowding, now</dt>
                <dd className="mt-0.5 font-semibold text-relief">{Math.round((selected.pressure ?? 0.4) * 100)}%</dd>
              </div>
              {selected.savingINR > 0 && (
                <div className="rounded-xl bg-paper p-3 sm:col-span-2">
                  <dt className="text-xs text-ash">Estimated savings</dt>
                  <dd className="mt-0.5 font-semibold text-ink">₹{selected.savingINR.toLocaleString('en-IN')}</dd>
                </div>
              )}
            </dl>
            <Link to="/swap"><Button variant="primary" className="mt-6">Check another trip</Button></Link>
          </Card>
        )}

        {type === 'decline' && (
          <Card className="text-center" padding="p-8">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-pressure/10 text-pressure">
              <TriangleAlert size={28} aria-hidden="true" />
            </span>
            <h1 className="mt-4 text-xl font-semibold text-ink">Keeping your original plan</h1>
            <p className="mt-2 text-sm text-ash">
              Proceeding with <strong className="text-ink">{requestedName}</strong> at {reqPressurePercent}% estimated crowding.
            </p>
            <Link to="/swap"><Button variant="secondary" className="mt-6">Back to crowding check</Button></Link>
          </Card>
        )}
      </div>
    </main>
  )
}
