import { create } from 'zustand'
import axios from 'axios'

// The agent orchestrator runs as its own service (ai-service/app/main.py),
// separate from the Express backend -- not proxied through /api like every
// other store here, so it gets its own small client instead of reusing lib/api.js.
const aiClient = axios.create({
  baseURL: import.meta.env.VITE_AI_SERVICE_URL || 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
})

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.response?.data?.detail?.[0]?.msg || error?.message || fallback

// The two-call "wait for decision" pattern the backend implements: the first
// /plan call with no `decision` returns status:"awaiting_decision" + the
// pressure/alternatives and stops there; the caller resubmits with the
// user's decision to continue. This store models exactly that, so the UI
// never silently redirects -- there is always an explicit accept/decline step.
export const usePlannerStore = create((set, get) => ({
  request: null, // the last request body sent, kept so the decision call can resubmit it
  awaitingDecision: false,
  pressure: null,
  alternatives: null,
  plan: null,
  isPlanning: false,
  error: null,

  clearError: () => set({ error: null }),
  reset: () => set({ request: null, awaitingDecision: false, pressure: null, alternatives: null, plan: null, error: null }),

  submitTrip: async (form) => {
    set({ isPlanning: true, error: null, plan: null })
    const request = {
      user_id: form.userId || 'guest',
      dest_id: form.destId,
      start_date: form.startDate,
      end_date: form.endDate,
      origin: form.origin,
      travellers: Number(form.travellers) || 1,
      budget_inr: Number(form.budgetInr) || 0,
      interests: form.interests || {},
    }
    try {
      const res = await aiClient.post('/plan', request)
      set({ request })
      if (res.data.status === 'awaiting_decision') {
        set({
          awaitingDecision: true,
          pressure: res.data.pressure,
          alternatives: res.data.alternatives,
        })
      } else {
        set({ awaitingDecision: false, plan: res.data })
      }
      return true
    } catch (error) {
      set({ error: getErrorMessage(error, 'Could not reach the trip planner') })
      return false
    } finally {
      set({ isPlanning: false })
    }
  },

  // decision: "accept" | "decline". selection only required on accept.
  submitDecision: async (decision, selection) => {
    const { request } = get()
    if (!request) return false
    set({ isPlanning: true, error: null })
    try {
      const body = { ...request, decision }
      if (decision === 'accept' && selection) {
        body.selected_dest_id = selection.destId
        body.selected_date = selection.date
      }
      const res = await aiClient.post('/plan', body)
      set({ awaitingDecision: false, plan: res.data })
      return true
    } catch (error) {
      set({ error: getErrorMessage(error, 'Could not submit your decision') })
      return false
    } finally {
      set({ isPlanning: false })
    }
  },
}))
