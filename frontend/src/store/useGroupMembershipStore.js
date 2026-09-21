import { create } from 'zustand'
import api, { getErrorMessage } from '../lib/api'

// Membership + squad operations for ONE group trip at a time -- join,
// leave, accept/reject (creator), the member list, match reasons for this
// specific group, itinerary/announcement edits, and the captain request.
// Kept separate from useGroupTravelStore's discovery/creation concerns
// (Revised Implementation Plan §16).
export const useGroupMembershipStore = create((set, get) => ({
  groupTrip: null,
  members: [],
  matchReasons: null,
  isLoading: false,
  error: null,

  isJoining: false,
  joinError: null,
  isLeaving: false,
  isActingOnMember: null, // targetUserId currently being accepted/rejected
  memberActionError: null,
  isUpdating: false,
  updateError: null,
  isRequestingCaptain: false,
  captainError: null,

  fetchGroupTrip: async (id) => {
    set({ isLoading: true, error: null })
    try {
      const [groupRes, membersRes] = await Promise.all([
        api.get(`/v1/group-trips/${id}`),
        api.get(`/v1/group-trips/${id}/members`),
      ])
      set({ groupTrip: groupRes.data.groupTrip, members: membersRes.data.members || [] })
      // Best-effort, not fatal: a creator viewing their own group has no
      // "match" concept against themself; a 4xx here just means no
      // reasons to show, not an error worth surfacing.
      api.get(`/v1/group-trips/${id}/matches`).then((res) => {
        set({ matchReasons: res.data })
      }).catch(() => {})
    } catch (error) {
      set({ error: getErrorMessage(error, 'Could not load this group trip') })
    } finally {
      set({ isLoading: false })
    }
  },

  refreshMembers: async (id) => {
    try {
      const res = await api.get(`/v1/group-trips/${id}/members`)
      set({ members: res.data.members || [] })
    } catch { /* silent refresh, the acting call already surfaced its own error */ }
  },

  joinGroupTrip: async (id) => {
    set({ isJoining: true, joinError: null })
    try {
      const res = await api.post(`/v1/group-trips/${id}/join`)
      await get().fetchGroupTrip(id)
      return { ok: true, autoAccepted: res.data.autoAccepted }
    } catch (error) {
      set({ joinError: getErrorMessage(error, 'Could not send a join request') })
      return { ok: false }
    } finally {
      set({ isJoining: false })
    }
  },

  leaveGroupTrip: async (id) => {
    set({ isLeaving: true })
    try {
      await api.post(`/v1/group-trips/${id}/leave`)
      await get().fetchGroupTrip(id)
      return true
    } catch (error) {
      set({ joinError: getErrorMessage(error, 'Could not leave this group') })
      return false
    } finally {
      set({ isLeaving: false })
    }
  },

  acceptMember: async (id, userId) => {
    set({ isActingOnMember: userId, memberActionError: null })
    try {
      await api.post(`/v1/group-trips/${id}/members/${userId}/accept`)
      await get().fetchGroupTrip(id)
    } catch (error) {
      set({ memberActionError: getErrorMessage(error, 'Could not accept this member') })
    } finally {
      set({ isActingOnMember: null })
    }
  },

  rejectMember: async (id, userId) => {
    set({ isActingOnMember: userId, memberActionError: null })
    try {
      await api.post(`/v1/group-trips/${id}/members/${userId}/reject`)
      await get().fetchGroupTrip(id)
    } catch (error) {
      set({ memberActionError: getErrorMessage(error, 'Could not reject this member') })
    } finally {
      set({ isActingOnMember: null })
    }
  },

  // Creator-only: itinerary/announcements/status edits -- reuses the one
  // generic PATCH the backend exposes rather than a separate endpoint per field.
  updateGroupTrip: async (id, data) => {
    set({ isUpdating: true, updateError: null })
    try {
      const res = await api.patch(`/v1/group-trips/${id}`, data)
      set({ groupTrip: res.data.groupTrip })
      return true
    } catch (error) {
      set({ updateError: getErrorMessage(error, 'Could not update this group') })
      return false
    } finally {
      set({ isUpdating: false })
    }
  },

  requestCaptain: async (id, { skillNeeded, budget } = {}) => {
    set({ isRequestingCaptain: true, captainError: null })
    try {
      await api.post(`/v1/group-trips/${id}/captain`, { skillNeeded, budget })
      await get().fetchGroupTrip(id)
      return true
    } catch (error) {
      set({ captainError: getErrorMessage(error, 'Could not request a captain for this group') })
      return false
    } finally {
      set({ isRequestingCaptain: false })
    }
  },
}))
