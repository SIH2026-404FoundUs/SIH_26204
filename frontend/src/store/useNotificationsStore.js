import { create } from 'zustand'
import api, { getErrorMessage } from '../lib/api'
import { useAuthStore } from './useAuthStore'

// "Read" tracking for the header bell's badge -- these notifications are
// composed live from three other collections (alerts/offers/waitlist, see
// below), there's no persisted Notification row of our own to stamp a
// readAt onto. Read state is therefore an id set kept in this browser's
// localStorage, scoped per user (so a shared machine doesn't leak one
// account's read state into another's), which is all "the badge clears once
// you've actually looked at them" needs -- it doesn't need to survive a
// user switching devices.
function readIdsKey() {
  const userId = useAuthStore.getState().authUser?._id
  return `sahyatri:notifications:read:${userId || 'anon'}`
}

function loadReadIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(readIdsKey()) || '[]'))
  } catch {
    return new Set()
  }
}

function saveReadIds(ids) {
  try {
    localStorage.setItem(readIdsKey(), JSON.stringify([...ids]))
  } catch {
    // Private browsing / storage disabled -- badge just won't persist across reloads, not fatal.
  }
}

// Notifications replace the old explicit "Travel Alerts" nav item, and now
// also surface offers and waitlist activity (spec: "notifications must come
// to traveller for new offers, waitlist and alerts") -- three real data
// sources merged into one feed, nothing new invented:
//
// 1. Alerts -- same verified-alert infrastructure/Alert collection as
//    before, filtered down to what's actually relevant to THIS traveller:
//    an alert only becomes a notification if it's for a destination they
//    have a real trip to, and its validity window overlaps that trip's
//    dates. GET /api/v1/alerts (the endpoint the old Alerts.jsx page and
//    Nishith's agent tool use) only ever returns alerts active *right now*
//    -- it can't surface a verified alert for a trip planned months out, so
//    composing against it client-side would silently show nothing for any
//    future trip even when a real, relevant alert exists. Uses the new,
//    additive GET /api/v1/alerts/for-trip?destId=&startDate=&endDate=
//    instead, which filters by the trip's own dates on the same Alert
//    collection -- one call per trip (a traveller has at most a handful).
// 2. Offers -- GET /api/v1/waitlist/notifications: every flash offer the
//    SmartWaitlist matching fan-out (processOfferMatching, on offer
//    creation) actually notified this traveller's waitlist entries about.
// 3. Waitlist status -- the same endpoint also includes a "fulfilled" entry
//    once a waitlist has been claimed through, so a status change is
//    visible here too, not just the original match moment.
// 4. Emergency broadcasts -- GET /v1/broadcast-alerts, active platform-wide
//    authority alerts. Public, not trip-scoped, so it's a flat fetch rather
//    than something composed per-trip like alerts. Gives a user who already
//    dismissed EmergencyBanner.jsx a place to still find it.
export const useNotificationsStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  error: null,

  fetchNotifications: async ({ silent = false } = {}) => {
    if (!silent) set({ isLoading: true })
    set({ error: null })
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

      const [alertResults, offerNotifRes, broadcasts] = await Promise.all([
        Promise.all(
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
        ),
        api.get('/v1/waitlist/notifications').then((res) => res.data || []).catch(() => []),
        api.get('/v1/broadcast-alerts').then((res) => res.data || []).catch(() => []),
      ])

      const notifications = []
      for (const { tripId, destId, dates, alerts } of alertResults) {
        for (const alert of alerts) {
          notifications.push({
            id: `${tripId}:${alert.hash || alert._id || `${destId}-${alert.kind}-${alert.fetchedAt}`}`,
            type: 'alert',
            destId,
            tripId,
            tripDates: dates,
            sentAt: alert.fetchedAt,
            ...alert,
          })
        }
      }
      for (const n of offerNotifRes) {
        notifications.push(n)
      }
      for (const b of broadcasts) {
        notifications.push({ id: `broadcast:${b._id}`, type: 'broadcast', sentAt: b.createdAt, ...b })
      }

      // Most recent first, across all four sources.
      notifications.sort((a, b) => new Date(b.sentAt || 0) - new Date(a.sentAt || 0))

      const readIds = loadReadIds()
      const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length

      set({ notifications, unreadCount })
    } catch (error) {
      set({ error: getErrorMessage(error, 'Could not load notifications') })
    } finally {
      set({ isLoading: false })
    }
  },

  // Called when the bell dropdown opens or the full /notifications page
  // loads -- "you've looked at these now" clears the badge without waiting
  // for the next poll. New notifications that arrive afterwards (a fresh
  // poll bringing an id not yet in the read set) bring the badge straight
  // back, since only ids seen so far get marked.
  markAllRead: () => {
    const readIds = loadReadIds()
    for (const n of get().notifications) readIds.add(n.id)
    saveReadIds(readIds)
    set({ unreadCount: 0 })
  },
}))
