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

  // No email verification step -- signup logs the traveller straight in,
  // same shape as login's own success response.
  signup: async (data) => {
    set({ isSigningUp: true, error: null })
    try {
      const res = await api.post('/auth/signup', data)
      set({ authUser: res.data })
      return res.data
    } catch (error) {
      set({ error: getErrorMessage(error, 'Could not create your account') })
      return null
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

  isUploadingPhoto: false,

  uploadProfilePhoto: async (file) => {
    set({ isUploadingPhoto: true, error: null })
    try {
      const formData = new FormData()
      formData.append('photo', file)
      const res = await api.post('/auth/profile-photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      set({ authUser: res.data })
      return true
    } catch (error) {
      set({ error: getErrorMessage(error, 'Could not upload your photo') })
      return false
    } finally {
      set({ isUploadingPhoto: false })
    }
  },

  removeProfilePhoto: async () => {
    set({ error: null })
    try {
      const res = await api.delete('/auth/profile-photo')
      set({ authUser: res.data })
      return true
    } catch (error) {
      set({ error: getErrorMessage(error, 'Could not remove your photo') })
      return false
    }
  },

  // ---- forgot / reset password ----
  forgotPassword: async (email) => {
    try {
      const res = await api.post('/auth/forgot-password', { email })
      return { ok: true, message: res.data.message }
    } catch (error) {
      return { ok: false, message: getErrorMessage(error, 'Could not send the reset email') }
    }
  },

  resetPassword: async ({ token, password, confirmPassword }) => {
    try {
      const res = await api.post('/auth/reset-password', { token, password, confirmPassword })
      return { ok: true, message: res.data.message }
    } catch (error) {
      return { ok: false, message: getErrorMessage(error, 'Could not reset your password') }
    }
  },

  // ---- change password (logged in) ----
  changePassword: async ({ currentPassword, newPassword, confirmNewPassword }) => {
    try {
      await api.patch('/auth/change-password', { currentPassword, newPassword, confirmNewPassword })
      return { ok: true, message: 'Password changed.' }
    } catch (error) {
      return { ok: false, message: getErrorMessage(error, 'Could not change your password') }
    }
  },
}))
