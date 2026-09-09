import { create } from 'zustand'
import api, { getErrorMessage } from '../lib/api'

// Backs the My Trips page (frontend sitemap doc, Page 6) against the real
// GET /api/v1/trips?userId= list endpoint -- added alongside this page since
// the trips collection existed but had no "list mine" route yet.
export const useTripsStore = create((set) => ({
  trips: [],
  isLoading: false,
  error: null,

  fetchMyTrips: async (userId) => {
    if (!userId) return
    set({ isLoading: true, error: null })
    try {
      const res = await api.get('/v1/trips', { params: { userId } })
      set({ trips: res.data })
    } catch (error) {
      set({ error: getErrorMessage(error, 'Could not load your trips') })
    } finally {
      set({ isLoading: false })
    }
  },
}))
