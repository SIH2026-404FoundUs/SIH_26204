import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, Calendar, Users, Wallet, Navigation, Check, X, LogIn } from 'lucide-react';
import { usePlannerStore } from '../../store/usePlannerStore';
import { useAuthStore } from '../../store/useAuthStore';
import { DESTINATION_GROUPS, getDestinationLabel } from '../../lib/destinations';

/**
 * TripPlannerSidebar - Floating trip planning drawer overlay on the Map canvas.
 * Collects origin, destination, dates, travellers, budget, selected hotel & stops,
 * and submits to POST /api/plan-trip via `usePlannerStore`.
 */
export default function TripPlannerSidebar({
  selectedDestId = 'manali',
  onChangeDestId,
  origin = 'Delhi',
  onChangeOrigin,
  startDate = '2026-12-25',
  onChangeStartDate,
  endDate = '2026-12-28',
  onChangeEndDate,
  budgetInr = 20000,
  onChangeBudgetInr,
  travellers = 2,
  onChangeTravellers,
  selectedHotel = null,
  stops = [],
  onClose
}) {
  const navigate = useNavigate();
  const authUser = useAuthStore((state) => state.authUser);
  const { submitTrip, isPlanning, plan, error, clearError, reset } = usePlannerStore();

  const [form, setForm] = useState({
    origin,
    startDate,
    endDate,
    travellers,
    budgetInr
  });

  useEffect(() => {
    setForm({ origin, startDate, endDate, travellers, budgetInr });
  }, [origin, startDate, endDate, travellers, budgetInr]);

  const [showItineraryModal, setShowItineraryModal] = useState(false);

  const handleFormChange = (field) => (e) => {
    const val = e.target.value;
    setForm((prev) => ({ ...prev, [field]: val }));
    if (field === 'origin' && onChangeOrigin) onChangeOrigin(val);
    if (field === 'startDate' && onChangeStartDate) onChangeStartDate(val);
    if (field === 'endDate' && onChangeEndDate) onChangeEndDate(val);
    if (field === 'budgetInr' && onChangeBudgetInr) onChangeBudgetInr(val);
    if (field === 'travellers' && onChangeTravellers) onChangeTravellers(val);
  };

  const handleSubmitPlan = async (e) => {
    e.preventDefault();
    if (isPlanning) return;
    clearError();

    if (!authUser) {
      navigate('/login');
      return;
    }

    const payload = {
      origin: form.origin,
      destId: selectedDestId,
      startDate: form.startDate,
      endDate: form.endDate,
      travellers: Number(form.travellers) || 1,
      budgetInr: Number(form.budgetInr) || 0,
      selectedHotel,
      stops
    };

    const success = await submitTrip(payload);
    if (success) {
      const state = usePlannerStore.getState();
      if (state.awaitingDecision) {
        // High Pressure Gating (>= 0.60) -> Redirect to /swap with tripDraftId
        navigate('/swap');
      } else if (state.plan) {
        // Low Pressure (< 0.60) -> Show itinerary overlay
        setShowItineraryModal(true);
      }
    }
  };

  return (
    <>
      <div className="absolute top-20 left-6 z-20 w-80 sm:w-96 rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-xl backdrop-blur-md transition-all animate-in fade-in slide-in-from-left-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Compass size={18} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-800">Plan This Trip</h3>
              <p className="text-[11px] font-semibold text-slate-400">Crowding check &amp; itinerary</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onClose && onClose()}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
          >
            <X size={14} />
          </button>
        </div>

        {/* Error Alert Toast */}
        {error && (
          <div className="mt-3 flex items-center justify-between rounded-xl bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700 font-semibold">
            <span>⚠️ {error}</span>
            <button type="button" onClick={clearError} className="underline text-rose-500 hover:text-rose-800">
              Dismiss
            </button>
          </div>
        )}

        {/* Form Inputs */}
        <form onSubmit={handleSubmitPlan} className="mt-3 space-y-3">
          {/* Destination Selector */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Destination
            </label>
            <select
              value={selectedDestId}
              onChange={(e) => onChangeDestId && onChangeDestId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none"
            >
              {DESTINATION_GROUPS.flatMap((g) => g.destinations).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          {/* Origin */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Travelling From
            </label>
            <div className="relative">
              <Navigation size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                required
                type="text"
                value={form.origin}
                onChange={handleFormChange('origin')}
                placeholder="e.g. Delhi"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Dates (Start / End) */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Start Date
              </label>
              <div className="relative">
                <Calendar size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  required
                  type="date"
                  value={form.startDate}
                  onChange={handleFormChange('startDate')}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-2 py-1.5 text-xs font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                End Date
              </label>
              <div className="relative">
                <Calendar size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  required
                  type="date"
                  value={form.endDate}
                  onChange={handleFormChange('endDate')}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-2 py-1.5 text-xs font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Travellers & Budget */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Travellers
              </label>
              <div className="relative">
                <Users size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  required
                  type="number"
                  min="1"
                  max="20"
                  value={form.travellers}
                  onChange={handleFormChange('travellers')}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-2 py-1.5 text-xs font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Budget (INR)
              </label>
              <div className="relative">
                <Wallet size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  required
                  type="number"
                  min="1000"
                  value={form.budgetInr}
                  onChange={handleFormChange('budgetInr')}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-2 py-1.5 text-xs font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Selected Hotel & Stops Summary Pill Badges */}
          <div className="pt-1 space-y-1.5">
            {selectedHotel ? (
              <div className="flex items-center justify-between rounded-xl bg-indigo-50/80 border border-indigo-100 p-2 text-xs font-semibold text-indigo-800">
                <span className="truncate">🏨 {selectedHotel.name}</span>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded-md">Selected</span>
              </div>
            ) : (
              <p className="text-[11px] font-medium text-slate-400 italic">No hotel selected (Click hotel pin to select)</p>
            )}

            {stops.length > 0 && (
              <div className="flex items-center justify-between rounded-xl bg-emerald-50/80 border border-emerald-100 p-2 text-xs font-semibold text-emerald-800">
                <span>📍 {stops.length} custom stop(s) added</span>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isPlanning}
            className="mt-3 w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isPlanning ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Checking Crowding &amp; Planning...</span>
              </>
            ) : (
              <>
                <Check size={16} />
                <span>Plan This Trip</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Low-Pressure Generated Itinerary Modal */}
      {showItineraryModal && plan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900">
                Trip Plan: {getDestinationLabel(plan.destId)}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowItineraryModal(false);
                  reset();
                }}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs text-slate-700">
              <p className="font-semibold text-slate-600">{plan.trip?.summary}</p>

              {plan.trip?.costBreakdown?.grandTotal != null && (
                <div className="rounded-xl bg-indigo-50 p-3 font-mono text-indigo-900 font-semibold">
                  Total Est. Cost: ₹{plan.trip.costBreakdown.grandTotal.toLocaleString('en-IN')}
                </div>
              )}

              {plan.trip?.itinerary?.days?.length > 0 && (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  <span className="font-bold uppercase tracking-wider text-slate-400 text-[10px]">
                    Itinerary Breakdown
                  </span>
                  {plan.trip.itinerary.days.map((d) => (
                    <div key={d.day} className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                      <div className="font-bold text-slate-800">Day {d.day}</div>
                      <div className="text-slate-500 mt-1">{d.stops?.map((s) => s.name || s).join(' • ') || 'Local Exploration'}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-5 text-right">
              <button
                type="button"
                onClick={() => {
                  setShowItineraryModal(false);
                  reset();
                }}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
