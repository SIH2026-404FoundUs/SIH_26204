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
// refetched on mount or an explicit refresh, never by the date picker.
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

  // Everything: called once on mount.
  fetchAll: () => {
    get().fetchDateScoped(get().date)
    get().fetchRedistribution()
    get().fetchAcceptance()
  },

  fetchDateScoped: (date = get().date) => {
    get().fetchPressure(date)
    get().fetchCapacity(date)
  },

  fetchPressure: async (date = get().date) => {
    set({ isLoadingPressure: true, pressureError: null })
    try {
      const res = await api.get('/v1/dashboard/pressure', { params: { date } })
      set({ pressure: res.data })
    } catch (error) {
      set({ pressureError: getErrorMessage(error, 'Could not load the pressure heatmap') })
    } finally {
      set({ isLoadingPressure: false })
    }
  },

  fetchCapacity: async (date = get().date) => {
    set({ isLoadingCapacity: true, capacityError: null })
    try {
      const res = await api.get('/v1/dashboard/capacity', { params: { date } })
      set({ capacity: res.data })
    } catch (error) {
      set({ capacityError: getErrorMessage(error, 'Could not load the capacity gap table') })
    } finally {
      set({ isLoadingCapacity: false })
    }
  },

  fetchRedistribution: async () => {
    set({ isLoadingRedistribution: true, redistributionError: null })
    try {
      const res = await api.get('/v1/dashboard/redistribution')
      set({ redistribution: res.data })
    } catch (error) {
      set({ redistributionError: getErrorMessage(error, 'Could not load redistribution impact') })
    } finally {
      set({ isLoadingRedistribution: false })
    }
  },

  fetchAcceptance: async () => {
    set({ isLoadingAcceptance: true, acceptanceError: null })
    try {
      const res = await api.get('/v1/dashboard/acceptance')
      set({ acceptance: res.data })
    } catch (error) {
      set({ acceptanceError: getErrorMessage(error, 'Could not load the acceptance rate') })
    } finally {
      set({ isLoadingAcceptance: false })
    }
  },
}))
