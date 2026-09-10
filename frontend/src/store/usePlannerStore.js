import { create } from 'zustand'
import axios from 'axios'
import { useAuthStore } from './useAuthStore'

// The agent orchestrator runs as its own service (ai-service/app/main.py),
// separate from the Express backend -- not proxied through /api like every
// other store here, so it gets its own small client instead of reusing lib/api.js.
const aiClient = axios.create({
  baseURL: import.meta.env.VITE_AI_SERVICE_URL || 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

const getErrorMessage = (error, fallback) => {
  if (error?.response?.status === 401) {
    return 'Please log in to plan your trip.'
  }
  return (
    error?.response?.data?.error
    || error?.response?.data?.detail?.[0]?.msg
    || (typeof error?.response?.data?.detail === 'string' ? error.response.data.detail : null)
    || error?.message
    || fallback
  )
}

const isObject = (value) => value !== null && typeof value === 'object'

const invalidResponse = (message) => {
  throw new Error(message)
}

const isPressureDecision = (data) => (
  isObject(data)
  && data.status === 'awaiting_decision'
  && typeof data.tripDraftId === 'string'
  && data.tripDraftId.length > 0
  && isObject(data.pressure)
  && typeof data.pressure.score === 'number'
  && isObject(data.alternatives)
  && isObject(data.alternatives.requested)
  && Array.isArray(data.alternatives.places)
  && Array.isArray(data.alternatives.dates)
)

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
  reset: () => set({ request: null, tripDraftId: null, awaitingDecision: false, pressure: null, alternatives: null, plan: null, isPlanning: false, error: null }),

  submitTrip: async (form) => {
    if (get().isPlanning) return false
    set({ isPlanning: true, error: null, plan: null, tripDraftId: null, awaitingDecision: false, pressure: null, alternatives: null })
    // Real authUser id so the trip is attributable -- otherwise every plan
    // saves under the literal string "guest" and the My Trips page (which
    // reads GET /api/v1/trips?userId=<authUser._id>) would always be empty.
    const request = {
      userId: useAuthStore.getState().authUser?._id || form.userId || 'guest',
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
        if (!isPressureDecision(res.data)) {
          invalidResponse('The trip planner returned an incomplete pressure decision.')
        }
        set({
          awaitingDecision: true,
          tripDraftId: res.data.tripDraftId,
          pressure: res.data.pressure,
          alternatives: res.data.alternatives,
        })
      } else {
        // Not gated: res.data IS the TripSummary itself, no envelope.
        if (!isObject(res.data) || typeof res.data.summary !== 'string') {
          invalidResponse('The trip planner returned an incomplete trip plan.')
        }
        set({
          awaitingDecision: false,
          tripDraftId: null,
          pressure: null,
          alternatives: null,
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
    if (!tripDraftId) {
      set({ error: 'This pressure decision has expired. Please start the trip plan again.' })
      return false
    }
    if (get().isPlanning) return false
    set({ isPlanning: true, error: null })
    try {
      const body = { tripDraftId, decision }
      if (decision === 'accept' && selection) {
        body.chosenAlternative = { destId: selection.destId, startDate: selection.date }
      }
      const res = await aiClient.post('/api/plan-trip/confirm', body)
      if (!isObject(res.data) || !isObject(res.data.trip) || !res.data.destId || !res.data.startDate) {
        invalidResponse('The trip planner returned an incomplete confirmed plan.')
      }
      set({
        awaitingDecision: false,
        tripDraftId: null,
        pressure: null,
        alternatives: null,
          plan: {
            trip: res.data.trip,
            alternatives: res.data.alternatives,
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

  // Applies a post-generation swap only after the user has previewed it. The
  // existing trip is not replaced by the preview; submitTrip regenerates the
  // complete downstream plan for the chosen destination/date.
  applySwap: async (swapOffers) => {
    const request = get().request
    if (!request || !swapOffers) return false
    const destinationSwap = swapOffers.destination_swap
    const dateSwap = swapOffers.date_swap
    const nextStart = dateSwap?.alternative_dates?.[0] || request.startDate
    const nextEnd = dateSwap?.alternative_dates?.[1] || request.endDate
    return get().submitTrip({
      origin: request.origin,
      destId: destinationSwap?.alternative_destination || request.destId,
      startDate: nextStart,
      endDate: nextEnd,
      travellers: request.travellers,
      budgetInr: request.budgetINR,
      interests: request.interests,
    })
  },
}))
