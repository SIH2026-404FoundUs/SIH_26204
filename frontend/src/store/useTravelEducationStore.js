import { create } from 'zustand'
import api, { getErrorMessage } from '../lib/api'

// Travel Education (Revised Implementation Plan §9/§16) -- its own
// per-feature store, separate from the destination/pressure fetches
// DestinationDetail.jsx already does inline, since education content is
// its own concern (structured content + feedback) that other pages
// (Group Trip detail, the AI agent's own reads) may also want later.
export const useTravelEducationStore = create((set) => ({
  education: null,
  pressureContext: null,
  safetyAlerts: [],
  isLoading: false,
  error: null,

  isSubmittingFeedback: false,
  feedbackResult: null,

  fetchEducation: async (destId) => {
    set({ isLoading: true, error: null, feedbackResult: null })
    try {
      const res = await api.get(`/v1/destinations/${destId}/education`)
      set({ education: res.data.education, pressureContext: res.data.pressureContext, safetyAlerts: res.data.safetyAlerts || [] })
    } catch (error) {
      set({ error: getErrorMessage(error, 'Could not load education content'), education: null })
    } finally {
      set({ isLoading: false })
    }
  },

  submitFeedback: async (destId, { helpful, comment }) => {
    set({ isSubmittingFeedback: true, feedbackResult: null })
    try {
      await api.post(`/v1/destinations/${destId}/education/feedback`, { helpful, comment })
      set({ feedbackResult: { tone: 'success', message: 'Thanks for the feedback.' } })
      return true
    } catch (error) {
      set({ feedbackResult: { tone: 'error', message: getErrorMessage(error, 'Could not submit feedback') } })
      return false
    } finally {
      set({ isSubmittingFeedback: false })
    }
  },
}))
