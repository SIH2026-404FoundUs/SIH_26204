import { create } from 'zustand'
import api, { getErrorMessage, setUnauthorizedHandler } from '../lib/api'

export const useAuthStore = create((set) => ({
  authUser: null,
  isCheckingAuth: true,
  isSigningUp: false,
  isLoggingIn: false,
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
    set({ error: null })
    try {
      const res = await api.put('/auth/update-profile', data)
      set({ authUser: res.data })
      return true
    } catch (error) {
      set({ error: getErrorMessage(error, 'Could not update your profile') })
      return false
    }
  },

  isUploadingPhoto: false,

  uploadProfilePhoto: async (file) => {
    set({ isUploadingPhoto: true, error: null })
    try {
      const formData = new FormData()
      formData.append('photo', file)
      // Content-Type: undefined (not omitted) -- `api`'s instance default is
      // 'application/json', so simply leaving this option out still leaves
      // that default in place for axios's own transformRequest step, which
      // would then JSON.stringify the FormData instead of sending it. And
      // setting it to the literal string 'multipart/form-data' (no boundary)
      // makes the browser send that exact header verbatim instead of
      // generating one with a real boundary, so busboy (multer's parser)
      // throws "Boundary not found" and crashes this endpoint with an
      // unhandled 500 on every upload -- both confirmed live against the
      // running backend. `undefined` clears the default so axios's FormData
      // handling takes over and the browser computes the correct
      // multipart/form-data; boundary=... header itself.
      const res = await api.post('/auth/profile-photo', formData, {
        headers: { 'Content-Type': undefined },
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

setUnauthorizedHandler(() => {
  if (useAuthStore.getState().authUser) useAuthStore.setState({ authUser: null })
})
