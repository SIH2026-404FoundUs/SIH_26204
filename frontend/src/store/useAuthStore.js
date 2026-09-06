import { create } from 'zustand'
import api, { getErrorMessage } from '../lib/api'

export const useAuthStore = create((set) => ({
  authUser: null,
  isCheckingAuth: true,
  isSigningUp: false,
  isLoggingIn: false,
  isUpdatingProfile: false,
  error: null,

  clearError: () => set({ error: null }),

  // Runs once on mount: the JWT lives in an httpOnly cookie, so the only way
  // to know whether we are logged in is to ask the server.
  checkAuth: async () => {
    try {
      const res = await api.get('/auth/check')
      set({ authUser: res.data })
    } catch {
      set({ authUser: null })
    } finally {
      set({ isCheckingAuth: false })
    }
  },

  signup: async (data) => {
    set({ isSigningUp: true, error: null })
    try {
      const res = await api.post('/auth/signup', data)
      set({ authUser: res.data })
      return true
    } catch (error) {
      set({ error: getErrorMessage(error, 'Could not create your account') })
      return false
    } finally {
      set({ isSigningUp: false })
    }
  },

  login: async (data) => {
    set({ isLoggingIn: true, error: null })
    try {
      const res = await api.post('/auth/login', data)
      set({ authUser: res.data })
      return true
    } catch (error) {
      set({ error: getErrorMessage(error, 'Could not log you in') })
      return false
    } finally {
      set({ isLoggingIn: false })
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout')
      set({ authUser: null, error: null })
      return true
    } catch (error) {
      set({ error: getErrorMessage(error, 'Could not log you out') })
      return false
    }
  },

  updateProfile: async (data) => {
    set({ isUpdatingProfile: true, error: null })
    try {
      const res = await api.put('/auth/update-profile', data)
      set({ authUser: res.data })
      return true
    } catch (error) {
      set({ error: getErrorMessage(error, 'Could not update your profile') })
      return false
    } finally {
      set({ isUpdatingProfile: false })
    }
  },
}))
