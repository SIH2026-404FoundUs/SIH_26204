import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5001/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
})

// The backend answers with { message } on failure; surface that string to callers.
export function getErrorMessage(error, fallback = 'Something went wrong') {
  return error?.response?.data?.message || error?.message || fallback
}

export default api
