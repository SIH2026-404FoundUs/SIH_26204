import { create } from 'zustand'
import api, { getErrorMessage } from '../lib/api'

const today = () => new Date().toISOString().slice(0, 10)

// Backs the Authority Dashboard's four sections. Each of the four
// GET /api/v1/dashboard/* endpoints is fetched and tracked independently --
// one section failing (loading/error) never blocks the other three from
// rendering their own real data (dashboard spec: "partial backend failures
// -- show available sections normally, clearly mark unavailable ones").
//
// Pressure and capacity are date-scoped; redistribution and acceptance are
// not (trips don't carry a single filterable date -- see
// dashboard.controller.js's own comment on this) and are only ever
// refetched on mount, an explicit refresh, or the poll timer, never by the
// date picker.
//
// Every fetch* action takes an optional {silent} flag: silent skips the
// loading-spinner flag so the poll timer (AuthorityDashboard.jsx, every
// 15s) can refresh data in the background without flashing "Loading…" over
// a tab an authority might already be reading -- travellers booking,
// joining waitlists, or getting redirected all change these numbers while
// this dashboard is open, so it can't just be a one-shot fetch on mount.
export const useAuthorityDashboardStore = create((set, get) => ({
  date: today(),

  pressure: null,
  isLoadingPressure: false,
  pressureError: null,

  capacity: null,
  isLoadingCapacity: false,
  capacityError: null,

  redistribution: null,
  isLoadingRedistribution: false,
  redistributionError: null,

  acceptance: null,
  isLoadingAcceptance: false,
  acceptanceError: null,

  setDate: (date) => {
    set({ date })
    get().fetchDateScoped(date)
  },

  // Everything: called on mount and by the poll timer. Returns a Promise
  // resolving once every section has actually finished, not just fired --
  // callers use this to know when it's safe to show a real "last synced".
  fetchAll: (opts) => Promise.all([
    get().fetchDateScoped(get().date, opts),
    get().fetchRedistribution(opts),
    get().fetchAcceptance(opts),
  ]),

  fetchDateScoped: (date = get().date, opts) => Promise.all([
    get().fetchPressure(date, opts),
    get().fetchCapacity(date, opts),
  ]),

  fetchPressure: async (date = get().date, { silent = false } = {}) => {
    if (!silent) set({ isLoadingPressure: true })
    set({ pressureError: null })
    try {
      const res = await api.get('/v1/dashboard/pressure', { params: { date } })
      set({ pressure: res.data })
    } catch (error) {
      set({ pressureError: getErrorMessage(error, 'Could not load the pressure heatmap') })
    } finally {
      if (!silent) set({ isLoadingPressure: false })
    }
  },

  fetchCapacity: async (date = get().date, { silent = false } = {}) => {
    if (!silent) set({ isLoadingCapacity: true })
    set({ capacityError: null })
    try {
      const res = await api.get('/v1/dashboard/capacity', { params: { date } })
      set({ capacity: res.data })
    } catch (error) {
      set({ capacityError: getErrorMessage(error, 'Could not load the capacity gap table') })
    } finally {
      if (!silent) set({ isLoadingCapacity: false })
    }
  },

  fetchRedistribution: async ({ silent = false } = {}) => {
    if (!silent) set({ isLoadingRedistribution: true })
    set({ redistributionError: null })
    try {
      const res = await api.get('/v1/dashboard/redistribution')
      set({ redistribution: res.data })
    } catch (error) {
      set({ redistributionError: getErrorMessage(error, 'Could not load redistribution impact') })
    } finally {
      if (!silent) set({ isLoadingRedistribution: false })
    }
  },

  fetchAcceptance: async ({ silent = false } = {}) => {
    if (!silent) set({ isLoadingAcceptance: true })
    set({ acceptanceError: null })
    try {
      const res = await api.get('/v1/dashboard/acceptance')
      set({ acceptance: res.data })
    } catch (error) {
      set({ acceptanceError: getErrorMessage(error, 'Could not load the acceptance rate') })
    } finally {
      if (!silent) set({ isLoadingAcceptance: false })
    }
  },
}))
