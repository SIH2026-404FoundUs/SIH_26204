import { create } from 'zustand'
import api, { getErrorMessage } from '../lib/api'

// Backs the My Trips page (frontend sitemap doc, Page 6) against the real
// GET /api/v1/trips?userId= list endpoint -- added alongside this page since
// the trips collection existed but had no "list mine" route yet.
export const useTripsStore = create((set) => ({
  trips: [],
  isLoading: false,
  error: null,

  // No userId param: the backend now derives the owner from the
  // authenticated session (trips.controller.js's req.user._id), not a
  // client-supplied query param -- see main's ownership-scoping fix.
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
}))
