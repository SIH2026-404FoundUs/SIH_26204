import { create } from 'zustand'
import api, { getErrorMessage } from '../lib/api'

export const useAuthStore = create((set) => ({
  authUser: null,
  isCheckingAuth: true,
  isSigningUp: false,
  isLoggingIn: false,
  isUpdatingProfile: false,
  error: null,
  // Set specifically on a 403 EMAIL_NOT_VERIFIED login response, so the UI
  // can show a "resend verification" action instead of a generic error
  // (auth spec §8: never say "Invalid credentials" when the real issue is
  // verification).
  unverifiedEmail: null,

  clearError: () => set({ error: null, unverifiedEmail: null }),

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

  // Does NOT set authUser -- signup no longer logs the user in (email
  // verification is a real gate, not cosmetic). Returns the response body
  // (or null on failure) so the caller can route to /verify-email with the
  // email address to display.
  signup: async (data) => {
    set({ isSigningUp: true, error: null })
    try {
      const res = await api.post('/auth/signup', data)
      return res.data
    } catch (error) {
      set({ error: getErrorMessage(error, 'Could not create your account') })
      return null
    } finally {
      set({ isSigningUp: false })
    }
  },

  login: async (data) => {
    set({ isLoggingIn: true, error: null, unverifiedEmail: null })
    try {
      const res = await api.post('/auth/login', data)
      set({ authUser: res.data })
      return true
    } catch (error) {
      if (error?.response?.data?.code === 'EMAIL_NOT_VERIFIED') {
        set({ error: error.response.data.message, unverifiedEmail: data.email })
      } else {
        set({ error: getErrorMessage(error, 'Could not log you in') })
      }
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

  // ---- email verification ----
  verifyEmail: async (token) => {
    try {
      const res = await api.post('/auth/verify-email', { token })
      return { ok: true, ...res.data }
    } catch (error) {
      return { ok: false, message: getErrorMessage(error, 'This verification link is invalid or has expired.') }
    }
  },

  resendVerification: async (email) => {
    try {
      const res = await api.post('/auth/resend-verification', { email })
      return { ok: true, message: res.data.message }
    } catch (error) {
      return { ok: false, message: getErrorMessage(error, 'Could not resend the verification email') }
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
