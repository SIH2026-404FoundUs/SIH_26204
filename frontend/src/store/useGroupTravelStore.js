import { create } from 'zustand'
import api, { getErrorMessage } from '../lib/api'

// Group Travel discovery + creation (Revised Implementation Plan §16: kept
// separate from useGroupMembershipStore so discovery/membership stay
// independently loadable/testable, not one giant traveller store).
export const useGroupTravelStore = create((set) => ({
  matches: [],
  isLoadingMatches: false,
  matchesError: null,

  myGroupTrips: [],
  isLoadingMyGroupTrips: false,
  myGroupTripsError: null,

  isCreating: false,
  createError: null,

  // Preference-matched discovery -- ranked server-side, explainable
  // reasons only (never a percentage, see groupMatching.js's own comment).
  searchMatches: async ({ destId, startDate, endDate }) => {
    set({ isLoadingMatches: true, matchesError: null })
    try {
      const res = await api.get('/v1/group-trips/search/matches', { params: { destId, startDate, endDate } })
      set({ matches: res.data.matches || [] })
    } catch (error) {
      set({ matchesError: getErrorMessage(error, 'Could not search group trips') })
    } finally {
      set({ isLoadingMatches: false })
    }
  },

  fetchMyGroupTrips: async () => {
    set({ isLoadingMyGroupTrips: true, myGroupTripsError: null })
    try {
      const res = await api.get('/v1/group-trips/me')
      set({ myGroupTrips: res.data.groupTrips || [] })
    } catch (error) {
      set({ myGroupTripsError: getErrorMessage(error, 'Could not load your group trips') })
    } finally {
      set({ isLoadingMyGroupTrips: false })
    }
  },

  createGroupTrip: async (data) => {
    set({ isCreating: true, createError: null })
    try {
      const res = await api.post('/v1/group-trips', data)
      return res.data.groupTrip
    } catch (error) {
      set({ createError: getErrorMessage(error, 'Could not create this group trip') })
      return null
    } finally {
      set({ isCreating: false })
    }
  },
}))
