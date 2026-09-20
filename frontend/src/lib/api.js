import axios from 'axios'
import axiosRetry from 'axios-retry'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5001/api',
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

// The backend answers with { message } on failure; surface that string to callers.
export function getErrorMessage(error, fallback = 'Something went wrong') {
  return error?.response?.data?.message || error?.message || fallback
}

export default api
