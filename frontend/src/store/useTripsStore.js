import { create } from 'zustand'
import api, { getErrorMessage } from '../lib/api'

// Backs the My Trips page (frontend sitemap doc, Page 6) against the real
// GET /api/v1/trips?userId= list endpoint -- added alongside this page since
// the trips collection existed but had no "list mine" route yet.
export const useTripsStore = create((set) => ({
  trips: [],
  isLoading: false,
  error: null,

  summary: null,
  isLoadingSummary: false,
  summaryError: null,

  fetchMyTrips: async () => {
    set({ isLoading: true, error: null })
    try {
      const res = await api.get('/v1/trips')
      set({ trips: res.data })
    } catch (error) {
      set({ error: getErrorMessage(error, 'Could not load your trips') })
    } finally {
      set({ isLoading: false })
    }
  },

  // Authority dashboard aggregate (GET /api/v1/trips/summary).
  fetchSummary: async () => {
    set({ isLoadingSummary: true, summaryError: null })
    try {
      const res = await api.get('/v1/trips/summary')
      set({ summary: res.data })
    } catch (error) {
      set({ summaryError: getErrorMessage(error, 'Could not load the redistribution summary') })
    } finally {
      set({ isLoadingSummary: false })
    }
  },
}))
