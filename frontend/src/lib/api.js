import axios from 'axios'
import axiosRetry from 'axios-retry'

// Backend REST origin (also used to resolve /api/... photo paths returned by the API).
export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001/api'

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
  // Without this, a dropped connection (real on the low-bandwidth/
  // intermittent-signal routes this app targets) hangs the request
  // forever instead of failing fast enough to retry or show an error.
  timeout: 15000,
})

// Transient failures (a dropped packet, a momentary 503) get 2 retries with
// exponential backoff + jitter before surfacing as an error -- axios-retry
// instead of hand-rolled retry logic, since its default retryCondition
// already only retries network errors/5xx on idempotent methods (GET, HEAD,
// OPTIONS, PUT, DELETE), never a POST that might have already gone through
// server-side (re-sending a booking or a complaint on a flaky connection
// would be worse than the original failure).
axiosRetry(api, {
  retries: 2,
  retryDelay: axiosRetry.exponentialDelay,
})

// A 401 on any non-auth call means the session cookie expired or was cleared;
// the auth store registers a handler so stale `authUser` state gets dropped
// (and ProtectedRoute redirects to login) instead of every page failing
// separately. Registered rather than imported to avoid a store <-> api cycle.
let onUnauthorized = null
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn }

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const url = error?.config?.url || ''
    // /auth/* 401s are expected (checkAuth when logged out, bad login password).
    if (error?.response?.status === 401 && !url.startsWith('/auth/')) onUnauthorized?.()
    return Promise.reject(error)
  }
)

// Separate origin (ai-service, FastAPI). Errors arrive as `detail`/`error`
// rather than `message`, so getErrorMessage below reads all three. No retry:
// these are POSTs that call paid LLMs.
export const aiApi = axios.create({
  baseURL: import.meta.env.VITE_AI_SERVICE_URL || 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
  timeout: 60000,
})

// The backend answers with { message } on failure; surface that string to callers.
export function getErrorMessage(error, fallback = 'Something went wrong') {
  const d = error?.response?.data
  return (
    d?.message
    || d?.error
    || d?.detail?.[0]?.msg
    || (typeof d?.detail === 'string' ? d.detail : null)
    || error?.message
    || fallback
  )
}

export default api
