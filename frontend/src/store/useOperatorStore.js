import { create } from 'zustand'
import api, { getErrorMessage } from '../lib/api'

// Everything the operator post-login experience needs: registering a
// business (POST /v1/businesses), the operator's own businesses
// (GET /v1/businesses/mine), the SmartWaitlist entries for one of them
// (GET /v1/waitlist/business/:id), creating a flash offer (the existing
// POST /v1/offers -- unchanged, operator-only server-side), the live
// Verify-a-Visit code for one business (GET /v1/visits/operator-code/:id,
// polled -- it rotates every 90s), browsing already-onboarded workers to
// hire (GET /v1/businesses/search, the exact same endpoint Available
// Services/Businesses use, filtered to worker types) with a "click to
// hire" contact reveal (GET /v1/businesses/:id/contact), and the "hire
// people" audio-upload fallback (POST /internal/onboarding/upload -- the
// same internal demo-safety pipeline the WhatsApp webhook itself feeds,
// per its own docstring: "never present this as the feature", so the UI
// is honest that this is a fallback for a real WhatsApp number that isn't
// provisioned in this environment, not a separate hiring system).
export const useOperatorStore = create((set) => ({
  myBusinesses: [],
  isLoadingBusinesses: false,
  businessesError: null,
  isRegistering: false,
  registerError: null,

  fetchMyBusinesses: async () => {
    set({ isLoadingBusinesses: true, businessesError: null })
    try {
      const res = await api.get('/v1/businesses/mine')
      set({ myBusinesses: res.data })
    } catch (error) {
      set({ businessesError: getErrorMessage(error, 'Could not load your businesses') })
    } finally {
      set({ isLoadingBusinesses: false })
    }
  },

  registerBusiness: async (data) => {
    set({ isRegistering: true, registerError: null })
    try {
      const res = await api.post('/v1/businesses', data)
      set((state) => ({ myBusinesses: [...state.myBusinesses, res.data] }))
      return res.data
    } catch (error) {
      set({ registerError: getErrorMessage(error, 'Could not register this business') })
      return null
    } finally {
      set({ isRegistering: false })
    }
  },

  // -- SmartWaitlist + offers --
  businessWaitlist: [],
  isLoadingWaitlist: false,
  waitlistError: null,

  // silent: true skips the loading spinner -- used by the poll timer so the
  // waitlist list doesn't flash a "Loading…" state every 15s, only the
  // initial fetch and manual refresh do.
  fetchBusinessWaitlist: async (businessId, { silent = false } = {}) => {
    if (!silent) set({ isLoadingWaitlist: true })
    set({ waitlistError: null })
    try {
      const res = await api.get(`/v1/waitlist/business/${businessId}`)
      set({ businessWaitlist: res.data })
    } catch (error) {
      set({ waitlistError: getErrorMessage(error, 'Could not load the waitlist') })
    } finally {
      if (!silent) set({ isLoadingWaitlist: false })
    }
  },

  // -- Bookings for one of the operator's businesses (GET /v1/bookings/business/:id,
  // shipped in the backend a release ago but never had a frontend consumer
  // until now -- travellers could book, but an operator had no way to see it). --
  businessBookings: [],
  isLoadingBookings: false,
  bookingsError: null,

  fetchBusinessBookings: async (businessId, { silent = false } = {}) => {
    if (!silent) set({ isLoadingBookings: true })
    set({ bookingsError: null })
    try {
      const res = await api.get(`/v1/bookings/business/${businessId}`)
      set({ businessBookings: res.data })
    } catch (error) {
      set({ bookingsError: getErrorMessage(error, 'Could not load bookings') })
    } finally {
      if (!silent) set({ isLoadingBookings: false })
    }
  },

  isCreatingOffer: false,
  offerError: null,
  lastOffer: null,
  lastOfferNotifiedCount: 0,

  createOffer: async (data) => {
    set({ isCreatingOffer: true, offerError: null, lastOffer: null })
    try {
      // POST /v1/offers responds {offer, notified} -- the offer itself is
      // nested, not the top-level body.
      const res = await api.post('/v1/offers', data)
      set({ lastOffer: res.data.offer, lastOfferNotifiedCount: res.data.notified ?? 0 })
      return true
    } catch (error) {
      set({ offerError: getErrorMessage(error, 'Could not create this offer') })
      return false
    } finally {
      set({ isCreatingOffer: false })
    }
  },

  // -- Verify a Visit (operator side: display the current code) --
  operatorCode: null,
  isLoadingCode: false,
  codeError: null,

  fetchOperatorCode: async (businessId) => {
    set({ isLoadingCode: true, codeError: null })
    try {
      const res = await api.get(`/v1/visits/operator-code/${businessId}`)
      set({ operatorCode: res.data })
    } catch (error) {
      set({ codeError: getErrorMessage(error, 'Could not load the current code') })
    } finally {
      set({ isLoadingCode: false })
    }
  },

  // -- Hire people: browse already-onboarded workers --
  workers: [],
  isLoadingWorkers: false,
  workersError: null,

  searchWorkers: async ({ destId, type }) => {
    set({ isLoadingWorkers: true, workersError: null })
    try {
      const res = await api.get('/v1/businesses/search', { params: { destId, type: type || undefined } })
      set({ workers: res.data })
    } catch (error) {
      set({ workersError: getErrorMessage(error, 'Could not load workers') })
    } finally {
      set({ isLoadingWorkers: false })
    }
  },

  // "Click to hire" -- reveals the real contact number for one worker
  // (GET /v1/businesses/:id/contact, operator-only). Keyed by businessId so
  // revealing one doesn't hide/refetch the others already shown.
  revealedContacts: {},
  revealingContactId: null,
  contactError: null,

  hireContact: async (businessId) => {
    set({ revealingContactId: businessId, contactError: null })
    try {
      const res = await api.get(`/v1/businesses/${businessId}/contact`)
      set((state) => ({ revealedContacts: { ...state.revealedContacts, [businessId]: res.data } }))
    } catch (error) {
      set({ contactError: getErrorMessage(error, 'Could not load contact details') })
    } finally {
      set({ revealingContactId: null })
    }
  },

  // -- Hire people (audio-upload onboarding fallback) --
  isSubmittingHire: false,
  hireError: null,
  hireResult: null,

  submitHireOnboarding: async ({ audioFile, destId, ownerPhone }) => {
    set({ isSubmittingHire: true, hireError: null, hireResult: null })
    try {
      const formData = new FormData()
      formData.append('audio', audioFile)
      formData.append('destId', destId)
      formData.append('ownerPhone', ownerPhone)
      const res = await api.post('/internal/onboarding/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      set({ hireResult: res.data })
      return true
    } catch (error) {
      set({ hireError: getErrorMessage(error, 'Could not process this recording') })
      return false
    } finally {
      set({ isSubmittingHire: false })
    }
  },

  // -- Analytics: real aggregate traveller activity across this operator's
  // businesses (GET /v1/analytics/operator) --
  analytics: null,
  isLoadingAnalytics: false,
  analyticsError: null,

  fetchAnalytics: async () => {
    set({ isLoadingAnalytics: true, analyticsError: null })
    try {
      const res = await api.get('/v1/analytics/operator')
      set({ analytics: res.data })
    } catch (error) {
      set({ analyticsError: getErrorMessage(error, 'Could not load analytics') })
    } finally {
      set({ isLoadingAnalytics: false })
    }
  },
}))
