import { create } from 'zustand'
import api, { getErrorMessage } from '../lib/api'

// Platform-wide emergency broadcasts (authority -> every account). GET is
// public -- both the site-wide banner (EmergencyBanner.jsx, shown even to a
// signed-out visitor) and the authority's own management page read from
// this one store.
export const useBroadcastAlertStore = create((set) => ({
  activeAlerts: [],
  isLoading: false,
  error: null,
  isSending: false,
  sendError: null,
  resolvingId: null,
  resolveError: null,

  fetchActive: async ({ silent = false } = {}) => {
    if (!silent) set({ isLoading: true })
    try {
      const res = await api.get('/v1/broadcast-alerts')
      set({ activeAlerts: res.data || [], isLoading: false, error: null })
    } catch (error) {
      set({ error: getErrorMessage(error, 'Could not load emergency alerts'), isLoading: false })
    }
  },

  sendBroadcast: async ({ title, body, severity }) => {
    set({ isSending: true, sendError: null })
    try {
      const res = await api.post('/v1/broadcast-alerts', { title, body, severity })
      set((state) => ({ activeAlerts: [res.data.broadcast, ...state.activeAlerts], isSending: false }))
      return res.data
    } catch (error) {
      set({ sendError: getErrorMessage(error, 'Could not send the alert'), isSending: false })
      return null
    }
  },

  resolveBroadcast: async (id) => {
    set({ resolvingId: id, resolveError: null })
    try {
      await api.patch(`/v1/broadcast-alerts/${id}/resolve`)
      set((state) => ({ activeAlerts: state.activeAlerts.filter((a) => a._id !== id), resolvingId: null }))
      return true
    } catch (error) {
      set({ resolveError: getErrorMessage(error, 'Could not resolve the alert'), resolvingId: null })
      return false
    }
  },
}))
