import { create } from 'zustand'
import api, { getErrorMessage } from '../lib/api'

// Operator Revenue Management System (operator-only) -- real KPIs today,
// a rule-based 7/30-day demand forecast, price/promotion/inventory
// recommendations, low-demand alerts, and a what-if price simulator, all
// derived from this operator's own real Booking/BusinessAvailability data
// plus the platform's existing destination-pressure engine. See
// backend/src/services/revenue/revenueEngine.js for why this is a
// transparent rule-based engine rather than a trained ML model right now.
export const useRevenueStore = create((set) => ({
  dashboard: null,
  isLoadingDashboard: false,
  dashboardError: null,

  fetchDashboard: async (businessId, { date, days = 7, silent = false } = {}) => {
    if (!businessId) return
    if (!silent) set({ isLoadingDashboard: true })
    set({ dashboardError: null })
    try {
      const res = await api.get(`/v1/revenue/${businessId}/dashboard`, { params: { date, days } })
      set({ dashboard: res.data })
    } catch (error) {
      set({ dashboardError: getErrorMessage(error, 'Could not load revenue data') })
    } finally {
      if (!silent) set({ isLoadingDashboard: false })
    }
  },

  simResult: null,
  isSimulating: false,
  simError: null,

  simulatePrices: async (businessId, { date, prices }) => {
    set({ isSimulating: true, simError: null })
    try {
      const res = await api.post(`/v1/revenue/${businessId}/simulate`, { date, prices })
      set({ simResult: res.data })
      return res.data
    } catch (error) {
      set({ simError: getErrorMessage(error, 'Could not run the simulation') })
      return null
    } finally {
      set({ isSimulating: false })
    }
  },

  reset: () => set({ dashboard: null, dashboardError: null, simResult: null, simError: null }),
}))
