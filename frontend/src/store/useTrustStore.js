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

  // community discovery ("Suggest a Place" for travellers)
  isSubmittingPlace: false,
  isUploadingPhotos: false,
  communityResult: null,
  communityError: null,

  // Uploads to the existing Cloudinary integration (backend/src/lib/cloudinary.js
  // -- configured but previously wired to no endpoint) and returns the
  // resulting secure URLs. A separate step from the submission itself:
  // POST /community/submissions' own `photos` field already expects URL
  // strings, not files.
  uploadCommunityPhotos: async (files) => {
    if (!files || files.length === 0) return []
    set({ isUploadingPhotos: true, communityError: null })
    try {
      const formData = new FormData()
      for (const file of files) formData.append('photos', file)
      const res = await api.post('/community/photos', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return res.data.urls
    } catch (error) {
      set({ communityError: getErrorMessage(error, 'Could not upload photos') })
      throw error
    } finally {
      set({ isUploadingPhotos: false })
    }
  },

  submitCommunityPlace: async ({ name, lat, lng, description, photos, state }) => {
    set({ isSubmittingPlace: true, communityError: null, communityResult: null })
    try {
      const res = await api.post('/community/submissions', { name, lat, lng, description, photos, state })
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

  // The other half of the review loop: what happened to a place this
  // traveller already suggested (GET /community/submissions/mine) --
  // previously a submission just vanished into the queue with no way to
  // ever check back on it.
  mySubmissions: [],
  isLoadingMySubmissions: false,

  fetchMySubmissions: async () => {
    set({ isLoadingMySubmissions: true })
    try {
      const res = await api.get('/community/submissions/mine')
      set({ mySubmissions: res.data })
    } catch {
      // Non-critical for the submit form itself -- leave silently empty.
    } finally {
      set({ isLoadingMySubmissions: false })
    }
  },

  // Community Forum: approved, anonymized suggestions -- public read
  // (GET /community/submissions/approved), reused by the Landing page's
  // "suggested places" section and the trip planner's nearby-suggestion count.
  forumPosts: [],
  isLoadingForum: false,
  forumError: null,

  fetchForumPosts: async ({ state, limit } = {}) => {
    set({ isLoadingForum: true, forumError: null })
    try {
      const res = await api.get('/community/submissions/approved', { params: { state, limit } })
      set({ forumPosts: res.data })
    } catch (error) {
      set({ forumError: getErrorMessage(error, 'Could not load the community forum') })
    } finally {
      set({ isLoadingForum: false })
    }
  },

  // Like/dislike a forum post -- optimistic update against the local list
  // (the server response carries the real counts/myReaction right back, so
  // this settles to the true state within one round trip either way).
  reactToPost: async (postId, reaction) => {
    const prevPosts = get().forumPosts
    set({
      forumPosts: prevPosts.map((p) => {
        if (p._id !== postId) return p
        const prevReaction = p.myReaction
        const nextReaction = prevReaction === reaction ? null : reaction // clicking the active reaction un-votes
        let likeCount = p.likeCount || 0
        let dislikeCount = p.dislikeCount || 0
        if (prevReaction === 'like') likeCount--
        if (prevReaction === 'dislike') dislikeCount--
        if (nextReaction === 'like') likeCount++
        if (nextReaction === 'dislike') dislikeCount++
        return { ...p, myReaction: nextReaction, likeCount, dislikeCount }
      }),
    })
    try {
      const res = await api.post(`/community/submissions/${postId}/react`, { reaction })
      set({
        forumPosts: get().forumPosts.map((p) =>
          p._id === postId ? { ...p, likeCount: res.data.likeCount, dislikeCount: res.data.dislikeCount, myReaction: res.data.myReaction } : p
        ),
      })
    } catch (error) {
      set({ forumPosts: prevPosts, forumError: getErrorMessage(error, 'Could not save your reaction') }) // roll back on failure
    }
  },

  nearbySuggestionCount: null,
  fetchNearbySuggestionCount: async (destId) => {
    if (!destId) return
    try {
      const res = await api.get('/community/nearby-count', { params: { destId } })
      set({ nearbySuggestionCount: res.data.count })
    } catch {
      set({ nearbySuggestionCount: null })
    }
  },

  // offers + waitlist
  offers: [],
  waitlists: [],
  isLoadingOffers: false,
  isLoadingWaitlists: false,
  marketError: null,

  fetchOffers: async (destId, { silent = false } = {}) => {
    if (!silent) set({ isLoadingOffers: true })
    set({ marketError: null })
    try {
      const res = await api.get('/v1/offers', { params: { destId } })
      set({ offers: res.data })
    } catch (error) {
      set({ marketError: getErrorMessage(error, 'Could not load offers') })
    } finally {
      if (!silent) set({ isLoadingOffers: false })
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

  fetchMyWaitlists: async ({ silent = false } = {}) => {
    if (!silent) set({ isLoadingWaitlists: true })
    set({ marketError: null })
    try {
      const res = await api.get('/v1/waitlist/mine')
      set({ waitlists: res.data })
    } catch (error) {
      set({ marketError: getErrorMessage(error, 'Could not load your waitlist entries') })
    } finally {
      if (!silent) set({ isLoadingWaitlists: false })
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

  // community moderation (authority-only: Community Review)
  queuedSubmissions: [],
  isLoadingQueue: false,
  isReviewing: false,
  moderationError: null,

  // silent: true skips the loading spinner -- used by the poll timer so a
  // new submission arriving doesn't flash "Loading…" over the queue an
  // authority might already be mid-review of.
  fetchQueuedSubmissions: async ({ silent = false } = {}) => {
    if (!silent) set({ isLoadingQueue: true })
    set({ moderationError: null })
    try {
      const res = await api.get('/community/submissions/queued')
      set({ queuedSubmissions: res.data })
    } catch (error) {
      set({ moderationError: getErrorMessage(error, 'Could not load the review queue') })
    } finally {
      if (!silent) set({ isLoadingQueue: false })
    }
  },

  // action: "approve" | "reject" | "flag" -- the exact same review endpoint
  // (POST /community/submissions/:id/review) that already existed; "flag"
  // is a new action value the backend now also accepts, same contract shape.
  reviewSubmission: async (submissionId, action, rejectionReason) => {
    set({ isReviewing: true, moderationError: null })
    try {
      await api.post(`/community/submissions/${submissionId}/review`, { action, rejectionReason })
      set((state) => ({ queuedSubmissions: state.queuedSubmissions.filter((s) => s._id !== submissionId) }))
      return true
    } catch (error) {
      set({ moderationError: getErrorMessage(error, 'Could not submit this review') })
      return false
    } finally {
      set({ isReviewing: false })
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

  // booking an Available Services business (POST /v1/bookings) -- confirmed
  // immediately only when a real declared-availability row exists to claim
  // from; otherwise a pending request, never a fabricated instant "booked".
  isBooking: false,
  bookingError: null,
  lastBooking: null,
  myBookings: [],
  isLoadingBookings: false,

  createBooking: async ({ businessId, date, travellers, notes }) => {
    set({ isBooking: true, bookingError: null, lastBooking: null })
    try {
      const res = await api.post('/v1/bookings', { businessId, date, travellers, notes })
      set((state) => ({ lastBooking: res.data, myBookings: [res.data, ...state.myBookings] }))
      return res.data
    } catch (error) {
      set({ bookingError: getErrorMessage(error, 'Could not book this service') })
      return null
    } finally {
      set({ isBooking: false })
    }
  },

  fetchMyBookings: async () => {
    set({ isLoadingBookings: true })
    try {
      const res = await api.get('/v1/bookings/mine')
      set({ myBookings: res.data })
    } catch {
      // Non-critical for the Available Services page itself -- leave silently empty.
    } finally {
      set({ isLoadingBookings: false })
    }
  },
}))
