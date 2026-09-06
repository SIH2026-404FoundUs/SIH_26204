import { create } from 'zustand'
import api, { getErrorMessage } from '../lib/api'

const today = () => new Date().toISOString().slice(0, 10)

// Reads Sathvik's pressure map endpoint (spec §10):
//   GET /v1/pressure/map?date=  -> every tracked destination, full §6 row each
// The heatmap renders the component breakdown straight from these rows, so
// there is no separate per-destination fetch.
export const usePressureStore = create((set, get) => ({
  date: today(),
  rows: [],
  isLoadingMap: false,
  error: null,

  setDate: (date) => {
    set({ date })
    get().fetchMap(date)
  },

  fetchMap: async (date = get().date) => {
    set({ isLoadingMap: true, error: null })
    try {
      const res = await api.get('/v1/pressure/map', { params: { date } })
      set({ rows: res.data })
    } catch (error) {
      set({ error: getErrorMessage(error, 'Could not load the pressure map') })
    } finally {
      set({ isLoadingMap: false })
    }
  },
}))
