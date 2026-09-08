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
  error?.response?.data?.error
  || error?.response?.data?.detail?.[0]?.msg
  || (typeof error?.response?.data?.detail === 'string' ? error.response.data.detail : null)
  || error?.message
  || fallback

// The two real backend endpoints (main.py) and their actual shapes:
//   POST /api/plan-trip          -> either {status:"awaiting_decision", tripDraftId,
//                                    pressure, alternatives} when pressure gates the
//                                    plan, OR the bare TripSummary dict when it doesn't.
//   POST /api/plan-trip/confirm  -> {..request fields.., tripDraftId, trip: TripSummary,
//                                    redistribution, alternativesOffered}
// Both branches get normalized into one `plan` shape here so the component only
// ever renders one thing, but every field in it traces back to a real response
// field -- nothing here is invented. This is the wait-for-decision pattern: the
// first call stops at "awaiting_decision" and nothing plans further until the
// traveller explicitly accepts or declines.
export const usePlannerStore = create((set, get) => ({
  request: null, // camelCase, exactly as sent -- {userId,origin,destId,startDate,endDate,travellers,budgetINR,interests}
  tripDraftId: null,
  awaitingDecision: false,
  pressure: null,
  alternatives: null,
  plan: null, // { trip, redistribution, destId, startDate, endDate } | null
  isPlanning: false,
  error: null,

  clearError: () => set({ error: null }),
  reset: () => set({ request: null, tripDraftId: null, awaitingDecision: false, pressure: null, alternatives: null, plan: null, error: null }),

  submitTrip: async (form) => {
    set({ isPlanning: true, error: null, plan: null })
    const request = {
      userId: form.userId || 'guest',
      origin: form.origin,
      destId: form.destId,
      startDate: form.startDate,
      endDate: form.endDate,
      travellers: Number(form.travellers) || 1,
      budgetINR: Number(form.budgetInr) || 0,
      interests: form.interests || {},
    }
    try {
      const res = await aiClient.post('/api/plan-trip', request)
      set({ request })
      if (res.data.status === 'awaiting_decision') {
        set({
          awaitingDecision: true,
          tripDraftId: res.data.tripDraftId,
          pressure: res.data.pressure,
          alternatives: res.data.alternatives,
        })
      } else {
        // Not gated: res.data IS the TripSummary itself, no envelope.
        set({
          awaitingDecision: false,
          plan: { trip: res.data, redistribution: null, destId: request.destId, startDate: request.startDate, endDate: request.endDate },
        })
      }
      return true
    } catch (error) {
      set({ error: getErrorMessage(error, 'Could not reach the trip planner') })
      return false
    } finally {
      set({ isPlanning: false })
    }
  },

  // decision: "accept" | "decline". selection ({destId} or {date}) only required on accept.
  submitDecision: async (decision, selection) => {
    const { tripDraftId } = get()
    if (!tripDraftId) return false
    set({ isPlanning: true, error: null })
    try {
      const body = { tripDraftId, decision }
      if (decision === 'accept' && selection) {
        body.chosenAlternative = { destId: selection.destId, startDate: selection.date }
      }
      const res = await aiClient.post('/api/plan-trip/confirm', body)
      set({
        awaitingDecision: false,
        plan: {
          trip: res.data.trip,
          redistribution: res.data.redistribution,
          destId: res.data.destId,
          startDate: res.data.startDate,
          endDate: res.data.endDate,
        },
      })
      return true
    } catch (error) {
      set({ error: getErrorMessage(error, 'Could not submit your decision') })
      return false
    } finally {
      set({ isPlanning: false })
    }
  },
}))
