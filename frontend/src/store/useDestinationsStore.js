import { create } from 'zustand'
import api from '../lib/api'

let destinationsRequest = null

export const useDestinationsStore = create((set, get) => ({
  destinations: [],
  isLoading: false,
  error: null,
  fetchDestinations: async () => {
    if (get().destinations.length > 0) return get().destinations
    if (destinationsRequest) return destinationsRequest
    set({ isLoading: true, error: null })
    destinationsRequest = api.get('/destinations')
      .then((res) => {
        const destinations = res.data?.data || res.data || []
        set({ destinations, isLoading: false })
        return destinations
      })
      .catch((error) => {
        set({ error, isLoading: false })
        throw error
      })
      .finally(() => { destinationsRequest = null })
    return destinationsRequest
  },
}))
