import { create } from 'zustand'
import api, { getErrorMessage } from '../lib/api'
import { readCache, writeCache } from '../lib/swrCache'

const today = () => new Date().toISOString().slice(0, 10)
const CACHE_KEY = 'authority-dashboard-summary'
const cached = readCache(CACHE_KEY)

// Backs the Authority Dashboard's four sections. All four are fetched in
// ONE request (GET /v1/dashboard/summary) instead of four separate ones --
// but each section still settles independently server-side, so one
// section failing never blocks the other three from rendering their own
// real data (dashboard spec: "partial backend failures -- show available
// sections normally, clearly mark unavailable ones").
//
// Pressure and capacity are date-scoped; redistribution and acceptance are
// not (trips don't carry a single filterable date -- see
// dashboard.controller.js's own comment on this), but the summary endpoint
// returns all four together regardless, so a date change just re-requests
// the same one endpoint with the new date.
//
// fetchAll takes an optional {silent} flag: silent skips the loading-
// spinner flags so the poll timer (AuthorityDashboard.jsx, every 15s) can
// refresh data in the background without flashing "Loading…" over a tab an
// authority might already be reading -- travellers booking, joining
// waitlists, or getting redirected all change these numbers while this
// dashboard is open, so it can't just be a one-shot fetch on mount.
// Stale-while-revalidate: a returning authority sees the dashboard's last
// known numbers the instant the page renders (from localStorage, this
// tab's previous session included) instead of a blocking spinner, while a
// real fetch quietly runs behind it and corrects anything that's changed.
// Only a genuinely first-ever visit (no cache yet) still shows "Loading…".
export const useAuthorityDashboardStore = create((set, get) => ({
  date: today(),

  pressure: cached?.pressure ?? null,
  isLoadingPressure: false,
  pressureError: null,

  capacity: cached?.capacity ?? null,
  isLoadingCapacity: false,
  capacityError: null,

  redistribution: cached?.redistribution ?? null,
  isLoadingRedistribution: false,
  redistributionError: null,

  acceptance: cached?.acceptance ?? null,
  isLoadingAcceptance: false,
  acceptanceError: null,

  setDate: (date) => {
    set({ date })
    get().fetchAll(undefined, date)
  },

  // Everything, in ONE request (GET /v1/dashboard/summary) instead of the
  // four separate round trips this used to fire on every mount and every
  // 15s poll -- same "one section failing never blocks the other three"
  // guarantee, just server-side now (each section settles independently and
  // the response always carries either real data or a per-section error,
  // never a whole-request failure that takes all four down together).
  fetchAll: async ({ silent = false } = {}, date = get().date) => {
    // Stale-while-revalidate: already have something on screen (either
    // seeded from cache at store-init, or from a previous fetch this
    // session) -- skip the spinner even on a non-silent call, same as the
    // poll timer already skips it. Only a true first-ever load shows one.
    const hasExisting = get().pressure || get().capacity || get().redistribution || get().acceptance
    const showSpinner = !silent && !hasExisting
    if (showSpinner) set({ isLoadingPressure: true, isLoadingCapacity: true, isLoadingRedistribution: true, isLoadingAcceptance: true })
    set({ pressureError: null, capacityError: null, redistributionError: null, acceptanceError: null })
    try {
      const res = await api.get('/v1/dashboard/summary', { params: { date } })
      const { pressure, capacity, redistribution, acceptance } = res.data
      set({
        pressure: pressure?.error ? null : pressure,
        pressureError: pressure?.error ? getErrorMessage({ message: pressure.error }, 'Could not load the pressure heatmap') : null,
        capacity: capacity?.error ? null : capacity,
        capacityError: capacity?.error ? getErrorMessage({ message: capacity.error }, 'Could not load the capacity gap table') : null,
        redistribution: redistribution?.error ? null : redistribution,
        redistributionError: redistribution?.error ? getErrorMessage({ message: redistribution.error }, 'Could not load redistribution impact') : null,
        acceptance: acceptance?.error ? null : acceptance,
        acceptanceError: acceptance?.error ? getErrorMessage({ message: acceptance.error }, 'Could not load the acceptance rate') : null,
      })
      // Cache only real data (never an error placeholder) so the next
      // mount's instant paint is always honest, never a frozen error state.
      writeCache(CACHE_KEY, {
        pressure: pressure?.error ? undefined : pressure,
        capacity: capacity?.error ? undefined : capacity,
        redistribution: redistribution?.error ? undefined : redistribution,
        acceptance: acceptance?.error ? undefined : acceptance,
      })
    } catch (error) {
      const message = getErrorMessage(error, 'Could not load the dashboard')
      set({ pressureError: message, capacityError: message, redistributionError: message, acceptanceError: message })
    } finally {
      if (showSpinner) set({ isLoadingPressure: false, isLoadingCapacity: false, isLoadingRedistribution: false, isLoadingAcceptance: false })
    }
  },
}))
