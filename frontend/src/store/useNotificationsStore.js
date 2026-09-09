import { create } from 'zustand'
import api, { getErrorMessage } from '../lib/api'

// Notifications replace the old explicit "Travel Alerts" nav item -- same
// underlying data (the verified-alert infrastructure/Alert collection), no
// separate data source, but filtered down to what's actually relevant to
// THIS traveller: an alert only becomes a notification if it's for a
// destination they have a real trip to, and its validity window overlaps
// that trip's dates.
//
// GET /api/v1/alerts (the endpoint the old Alerts.jsx page and Nishith's
// agent tool use) only ever returns alerts active *right now* -- it can't
// surface a verified alert for a trip planned months out, so composing
// against it client-side would silently show nothing for any future trip
// even when a real, relevant alert exists. Uses the new, additive
// GET /api/v1/alerts/for-trip?destId=&startDate=&endDate= instead, which
// filters by the trip's own dates on the same Alert collection -- one call
// per trip (a traveller has at most a handful), no new backend aggregation
// beyond that filter, and the server is the source of truth for the
// overlap -- not a client-side re-derivation of it.

export const useNotificationsStore = create((set) => ({
  notifications: [],
  isLoading: false,
  error: null,

  fetchNotifications: async () => {
    set({ isLoading: true, error: null })
    try {
      const tripsRes = await api.get('/v1/trips')
      const trips = tripsRes.data || []

      const tripEntries = []
      for (const trip of trips) {
        const destId = trip.redirectedToDestId || trip.requestedDestId
        const dates = trip.finalDates?.startDate ? trip.finalDates : trip.requestedDates
        if (!destId || !dates?.startDate) continue
        tripEntries.push({ tripId: trip._id, destId, dates })
      }

      const results = await Promise.all(
        tripEntries.map(async ({ tripId, destId, dates }) => {
          try {
            const res = await api.get('/v1/alerts/for-trip', {
              params: { destId, startDate: dates.startDate, endDate: dates.endDate || dates.startDate },
            })
            return { tripId, destId, dates, alerts: res.data || [] }
          } catch {
            return { tripId, destId, dates, alerts: [] } // one trip's alert fetch failing shouldn't blank the whole list
          }
        })
      )

      const notifications = []
      for (const { tripId, destId, dates, alerts } of results) {
        for (const alert of alerts) {
          notifications.push({
            id: `${tripId}:${alert.hash || alert._id || `${destId}-${alert.kind}-${alert.fetchedAt}`}`,
            destId,
            tripId,
            tripDates: dates,
            ...alert,
          })
        }
      }

      set({ notifications })
    } catch (error) {
      set({ error: getErrorMessage(error, 'Could not load notifications') })
    } finally {
      set({ isLoading: false })
    }
  },
}))
