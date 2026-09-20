import { create } from 'zustand'
import api, { getErrorMessage } from '../lib/api'
import { sendOrQueue } from '../lib/offlineQueue'

// Worker role -- the gig-matching layer split out of Operator/Business
// (worker-role-spec.md). Everything a worker's own screens need: their
// profile (skills, service area, availability, rate expectation), browsing
// open gigs nearby, accepting one, and tracking "My Jobs" through to
// complete + rate. Operator-side gig actions (post a gig, track posted
// gigs) live in useOperatorStore.js instead -- this store is the worker's
// own half of the same marketplace.
export const useWorkerStore = create((set, get) => ({
  profile: null,
  isLoadingProfile: false,
  profileError: null,
  hasCheckedProfile: false, // distinguishes "still loading" from "checked, genuinely no profile yet" for the onboarding gate

  fetchMyProfile: async () => {
    set({ isLoadingProfile: true, profileError: null })
    try {
      const res = await api.get('/v1/workers/me')
      set({ profile: res.data })
    } catch (error) {
      if (error?.response?.status === 404) {
        set({ profile: null }) // no profile yet -- not an error, the onboarding screen's own real state
      } else {
        set({ profileError: getErrorMessage(error, 'Could not load your worker profile') })
      }
    } finally {
      set({ isLoadingProfile: false, hasCheckedProfile: true })
    }
  },

  isSavingProfile: false,
  saveProfileError: null,

  saveProfile: async (data) => {
    set({ isSavingProfile: true, saveProfileError: null })
    try {
      const res = await api.post('/v1/workers', data)
      set({ profile: res.data })
      return true
    } catch (error) {
      set({ saveProfileError: getErrorMessage(error, 'Could not save your profile') })
      return false
    } finally {
      set({ isSavingProfile: false })
    }
  },

  isSavingAvailability: false,
  availabilityError: null,

  updateAvailability: async (data) => {
    set({ isSavingAvailability: true, availabilityError: null })
    try {
      const res = await api.patch('/v1/workers/me/availability', data)
      set({ profile: res.data })
      return true
    } catch (error) {
      set({ availabilityError: getErrorMessage(error, 'Could not update availability') })
      return false
    } finally {
      set({ isSavingAvailability: false })
    }
  },

  // -- Gigs Near You (browse) --
  openGigs: [],
  isLoadingGigs: false,
  gigsError: null,

  fetchOpenGigs: async ({ destId, skill, silent = false } = {}) => {
    if (!silent) set({ isLoadingGigs: true })
    set({ gigsError: null })
    try {
      const res = await api.get('/v1/gigs', { params: { destId: destId || undefined, skill: skill || undefined } })
      set({ openGigs: res.data })
    } catch (error) {
      set({ gigsError: getErrorMessage(error, 'Could not load nearby gigs') })
    } finally {
      if (!silent) set({ isLoadingGigs: false })
    }
  },

  isAccepting: null, // gigId currently being accepted, so only that card shows a spinner
  acceptError: null,

  // Offline-tolerant, but honestly so: accepting is a first-claim-wins race
  // (acceptGig service, backend), so a queued accept can't be shown as a
  // real success -- it's only ever removed from the open-gigs list once the
  // server actually confirms it, never speculatively on queue.
  acceptGig: async (gigId) => {
    set({ isAccepting: gigId, acceptError: null })
    const result = await sendOrQueue({ method: 'post', url: `/v1/gigs/${gigId}/accept`, label: 'Accept gig' })
    if (result.ok && !result.queued) {
      set((state) => ({ openGigs: state.openGigs.filter((g) => g._id !== gigId) }))
      get().fetchMyGigs({ silent: true })
    } else if (!result.ok) {
      set({ acceptError: getErrorMessage(result.error, 'Could not accept this gig -- it may already be filled') })
    }
    set({ isAccepting: null })
    return { ok: result.ok, queued: result.queued === true }
  },

  // -- My Jobs (accepted, upcoming, history) --
  myGigs: [],
  isLoadingMyGigs: false,
  myGigsError: null,

  fetchMyGigs: async ({ silent = false } = {}) => {
    if (!silent) set({ isLoadingMyGigs: true })
    set({ myGigsError: null })
    try {
      const res = await api.get('/v1/workers/me/gigs')
      set({ myGigs: res.data })
    } catch (error) {
      set({ myGigsError: getErrorMessage(error, 'Could not load your jobs') })
    } finally {
      if (!silent) set({ isLoadingMyGigs: false })
    }
  },

  isCompleting: null,
  completeError: null,

  // Offline-tolerant: marking a job complete out in the field (patchy
  // signal is the norm, not the exception, for this action) queues and
  // syncs automatically instead of forcing a retry once back in range.
  completeGig: async (gigId) => {
    set({ isCompleting: gigId, completeError: null })
    const result = await sendOrQueue({ method: 'post', url: `/v1/gigs/${gigId}/complete`, label: 'Complete gig' })
    if (result.ok && !result.queued) {
      await get().fetchMyGigs({ silent: true })
    } else if (!result.ok) {
      set({ completeError: getErrorMessage(result.error, 'Could not mark this job complete') })
    }
    set({ isCompleting: null })
    return { ok: result.ok, queued: result.queued === true }
  },

  isRating: null,
  rateError: null,

  rateGig: async (gigId, { score, comment }) => {
    set({ isRating: gigId, rateError: null })
    try {
      await api.post(`/v1/gigs/${gigId}/rate`, { score, comment })
      await get().fetchMyGigs({ silent: true })
      return true
    } catch (error) {
      set({ rateError: getErrorMessage(error, 'Could not submit this rating') })
      return false
    } finally {
      set({ isRating: null })
    }
  },
}))
