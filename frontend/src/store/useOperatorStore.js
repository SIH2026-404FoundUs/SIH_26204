import { create } from 'zustand'
import api, { getErrorMessage } from '../lib/api'
import { sendOrQueue } from '../lib/offlineQueue'

// Everything the operator post-login experience needs: registering a
// business (POST /v1/businesses), the operator's own businesses
// (GET /v1/businesses/mine), the SmartWaitlist entries for one of them
// (GET /v1/waitlist/business/:id), creating a flash offer (the existing
// POST /v1/offers -- unchanged, operator-only server-side), the live
// Verify-a-Visit code for one business (GET /v1/visits/operator-code/:id,
// polled -- it rotates every 90s), and browsing already-onboarded workers
// to hire (GET /v1/businesses/search, the exact same endpoint Available
// Services/Businesses use, filtered to worker types) with a "click to
// hire" contact reveal (GET /v1/businesses/:id/contact). Onboarding a new
// worker happens through the real WhatsApp voice pipeline itself, not a
// form in this store.
export const useOperatorStore = create((set, get) => ({
  myBusinesses: [],
  isLoadingBusinesses: false,
  businessesError: null,
  isRegistering: false,
  registerError: null,
  availability: [],
  isLoadingAvailability: false,
  availabilityError: null,
  isSavingAvailability: false,

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

  fetchAvailability: async (businessId) => {
    set({ isLoadingAvailability: true, availabilityError: null })
    try {
      const res = await api.get(`/v1/businesses/${businessId}/availability`)
      set({ availability: res.data })
    } catch (error) {
      set({ availabilityError: getErrorMessage(error, 'Could not load availability') })
    } finally { set({ isLoadingAvailability: false }) }
  },

  // Offline-tolerant: a genuine connectivity drop (not a server rejection)
  // queues this write instead of failing it outright -- exactly the
  // operator-on-a-patchy-signal case this app's low-bandwidth pass targets.
  // Returns { ok, queued } so the caller can tell "saved" from "will sync
  // once back online" apart, instead of collapsing both into one boolean.
  saveAvailability: async (businessId, data) => {
    set({ isSavingAvailability: true, availabilityError: null })
    const result = await sendOrQueue({ method: 'post', url: `/v1/businesses/${businessId}/availability`, data, label: 'Update availability' })
    if (result.ok && !result.queued) {
      set((state) => ({ availability: [...state.availability.filter((row) => row._id !== result.data._id), result.data].sort((a, b) => new Date(a.date) - new Date(b.date)) }))
    } else if (!result.ok) {
      set({ availabilityError: result.message })
    }
    set({ isSavingAvailability: false })
    return { ok: result.ok, queued: result.queued === true }
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

  // -- Local Tourism Business Growth Platform: the same growthRanking
  // formula that already silently orders GET /v1/businesses/search results,
  // now surfaced so an operator can see their own multiplier breakdown
  // instead of it working invisibly in the background. --
  growth: null,
  isLoadingGrowth: false,
  growthError: null,

  fetchGrowth: async (businessId) => {
    set({ isLoadingGrowth: true, growthError: null })
    try {
      const res = await api.get(`/v1/businesses/${businessId}/growth`)
      set({ growth: res.data })
    } catch (error) {
      set({ growthError: getErrorMessage(error, 'Could not load growth insights') })
    } finally {
      set({ isLoadingGrowth: false })
    }
  },

  // -- AI Tourist Feedback Intelligence: themes/actions extracted from real
  // traveller reviews (GET reads whatever's cached; POST re-runs the
  // extraction and re-caches it onto the business). --
  feedbackInsights: null,
  isLoadingFeedbackInsights: false,
  isProcessingFeedback: false,
  feedbackInsightsError: null,

  fetchFeedbackInsights: async (businessId) => {
    set({ isLoadingFeedbackInsights: true, feedbackInsightsError: null })
    try {
      const res = await api.get(`/v1/feedback/business/${businessId}/insights`)
      set({ feedbackInsights: res.data })
    } catch (error) {
      set({ feedbackInsightsError: getErrorMessage(error, 'Could not load feedback insights') })
    } finally {
      set({ isLoadingFeedbackInsights: false })
    }
  },

  reprocessFeedback: async (businessId) => {
    set({ isProcessingFeedback: true, feedbackInsightsError: null })
    try {
      const res = await api.post(`/v1/feedback/business/${businessId}/process`)
      if (res.data.processed) {
        set({ feedbackInsights: { businessId, totalReviews: res.data.totalReviews, averageRating: res.data.averageRating, meetsThreshold: true, themes: res.data.themes, actions: res.data.actions } })
      }
      return res.data
    } catch (error) {
      set({ feedbackInsightsError: getErrorMessage(error, 'Could not process feedback') })
      return null
    } finally {
      set({ isProcessingFeedback: false })
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

  // -- Worker role: "Post a Gig" (GET/POST /v1/operators/me/gigs, /v1/gigs) --
  // an operator's own posted GigRequests, plus posting a new one. Separate
  // from useWorkerStore.js (that one is the worker side of the same
  // marketplace: browsing/accepting/completing gigs).
  postedGigs: [],
  isLoadingPostedGigs: false,
  postedGigsError: null,

  fetchPostedGigs: async ({ silent = false } = {}) => {
    if (!silent) set({ isLoadingPostedGigs: true })
    set({ postedGigsError: null })
    try {
      const res = await api.get('/v1/operators/me/gigs')
      set({ postedGigs: res.data })
    } catch (error) {
      set({ postedGigsError: getErrorMessage(error, 'Could not load your posted gigs') })
    } finally {
      if (!silent) set({ isLoadingPostedGigs: false })
    }
  },

  isPostingGig: false,
  postGigError: null,
  lastPostedGigNotifiedCount: null,

  postGig: async (data) => {
    set({ isPostingGig: true, postGigError: null, lastPostedGigNotifiedCount: null })
    try {
      // POST /v1/gigs responds {gigRequest, notified} -- same nested shape
      // as POST /v1/offers.
      const res = await api.post('/v1/gigs', data)
      set((state) => ({ postedGigs: [res.data.gigRequest, ...state.postedGigs], lastPostedGigNotifiedCount: res.data.notified ?? 0 }))
      return res.data
    } catch (error) {
      set({ postGigError: getErrorMessage(error, 'Could not post this gig') })
      return null
    } finally {
      set({ isPostingGig: false })
    }
  },

  isCompletingGig: false,
  completeGigError: null,

  completeGig: async (gigId) => {
    set({ isCompletingGig: true, completeGigError: null })
    try {
      await api.post(`/v1/gigs/${gigId}/complete`)
      await get().fetchPostedGigs({ silent: true })
      return true
    } catch (error) {
      set({ completeGigError: getErrorMessage(error, 'Could not mark this gig complete') })
      return false
    } finally {
      set({ isCompletingGig: false })
    }
  },

  isRatingGig: false,
  rateGigError: null,

  rateGig: async (gigId, { score, comment }) => {
    set({ isRatingGig: true, rateGigError: null })
    try {
      await api.post(`/v1/gigs/${gigId}/rate`, { score, comment })
      await get().fetchPostedGigs({ silent: true })
      return true
    } catch (error) {
      set({ rateGigError: getErrorMessage(error, 'Could not submit this rating') })
      return false
    } finally {
      set({ isRatingGig: false })
    }
  },
}))
