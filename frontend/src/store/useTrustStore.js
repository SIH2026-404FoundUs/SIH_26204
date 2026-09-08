import { create } from 'zustand'
import api, { getErrorMessage } from '../lib/api'

// Everything backing the trust-vertical pages: proof-of-visit, community
// discovery, offers/waitlist, alerts, safety surfaces, business search.
// One store because these are thin CRUD-ish calls with no shared derived
// state worth splitting apart.
export const useTrustStore = create((set, get) => ({
  // proof-of-visit
  isVerifying: false,
  lastVisitResult: null,
  visitError: null,

  verifyVisit: async ({ businessId, code }) => {
    set({ isVerifying: true, visitError: null, lastVisitResult: null })
    try {
      const res = await api.post('/v1/visits/verify', { businessId, code })
      set({ lastVisitResult: res.data })
      return res.data.status === 'verified'
    } catch (error) {
      const data = error?.response?.data
      if (data) {
        set({ lastVisitResult: data })
      } else {
        set({ visitError: getErrorMessage(error, 'Could not verify visit') })
      }
      return false
    } finally {
      set({ isVerifying: false })
    }
  },

  // community discovery
  isSubmittingPlace: false,
  communityResult: null,
  communityError: null,

  submitCommunityPlace: async ({ name, lat, lng, description }) => {
    set({ isSubmittingPlace: true, communityError: null, communityResult: null })
    try {
      const res = await api.post('/community/submissions', { name, lat, lng, description })
      set({ communityResult: res.data })
      return true
    } catch (error) {
      const data = error?.response?.data
      if (data) set({ communityResult: data })
      set({ communityError: getErrorMessage(error, 'Could not submit this place') })
      return false
    } finally {
      set({ isSubmittingPlace: false })
    }
  },

  // offers + waitlist
  offers: [],
  waitlists: [],
  isLoadingOffers: false,
  isLoadingWaitlists: false,
  marketError: null,

  fetchOffers: async (destId) => {
    set({ isLoadingOffers: true, marketError: null })
    try {
      const res = await api.get('/v1/offers', { params: { destId } })
      set({ offers: res.data })
    } catch (error) {
      set({ marketError: getErrorMessage(error, 'Could not load offers') })
    } finally {
      set({ isLoadingOffers: false })
    }
  },

  claimOffer: async (offerId) => {
    set({ marketError: null })
    try {
      await api.post(`/v1/offers/${offerId}/claim`)
      set((state) => ({ offers: state.offers.filter((o) => o._id !== offerId) }))
      return true
    } catch (error) {
      set({ marketError: getErrorMessage(error, 'Could not claim this offer') })
      return false
    }
  },

  fetchMyWaitlists: async () => {
    set({ isLoadingWaitlists: true, marketError: null })
    try {
      const res = await api.get('/v1/waitlist/mine')
      set({ waitlists: res.data })
    } catch (error) {
      set({ marketError: getErrorMessage(error, 'Could not load your waitlist entries') })
    } finally {
      set({ isLoadingWaitlists: false })
    }
  },

  joinWaitlist: async ({ destId, windowFrom, windowTo, maxPriceINR, travellers }) => {
    set({ marketError: null })
    try {
      await api.post('/v1/waitlist', { destId, windowFrom, windowTo, maxPriceINR, travellers })
      await get().fetchMyWaitlists()
      return true
    } catch (error) {
      set({ marketError: getErrorMessage(error, 'Could not join the waitlist') })
      return false
    }
  },

  cancelWaitlist: async (id) => {
    try {
      await api.delete(`/v1/waitlist/${id}`)
      set((state) => ({ waitlists: state.waitlists.filter((w) => w._id !== id) }))
    } catch (error) {
      set({ marketError: getErrorMessage(error, 'Could not cancel this entry') })
    }
  },

  // alerts + safety
  alerts: [],
  isLoadingAlerts: false,
  emergencyContacts: null,
  safetyError: null,

  fetchAlerts: async (destId) => {
    set({ isLoadingAlerts: true, safetyError: null })
    try {
      const res = await api.get('/v1/alerts', { params: { destId } })
      set({ alerts: res.data })
    } catch (error) {
      set({ safetyError: getErrorMessage(error, 'Could not load alerts') })
    } finally {
      set({ isLoadingAlerts: false })
    }
  },

  fetchEmergencyContacts: async (destId) => {
    set({ safetyError: null })
    try {
      const res = await api.get(`/v1/safety/emergency-contacts/${destId}`)
      set({ emergencyContacts: res.data })
    } catch (error) {
      set({ safetyError: getErrorMessage(error, 'Could not load emergency contacts') })
    }
  },

  isSubmittingComplaint: false,
  complaintResult: null,

  submitComplaint: async ({ destId, category, text }) => {
    set({ isSubmittingComplaint: true, safetyError: null, complaintResult: null })
    try {
      const res = await api.post('/v1/safety/complaints', { destId, category, text })
      set({ complaintResult: res.data })
      return true
    } catch (error) {
      set({ safetyError: getErrorMessage(error, 'Could not submit your complaint') })
      return false
    } finally {
      set({ isSubmittingComplaint: false })
    }
  },

  // business search (growth-ranked)
  businesses: [],
  isLoadingBusinesses: false,
  businessError: null,

  searchBusinesses: async ({ destId, type }) => {
    set({ isLoadingBusinesses: true, businessError: null })
    try {
      const res = await api.get('/v1/businesses/search', { params: { destId, type: type || undefined } })
      set({ businesses: res.data })
    } catch (error) {
      set({ businessError: getErrorMessage(error, 'Could not load businesses') })
    } finally {
      set({ isLoadingBusinesses: false })
    }
  },
}))
