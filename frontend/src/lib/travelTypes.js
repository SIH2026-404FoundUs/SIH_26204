import { useEffect, useState } from 'react'
import api from './api'

// Mirrors destinations.js's own fetch-once-and-cache pattern: the taxonomy
// lives once, in the backend (backend/src/lib/travelTypes.js), fetched
// from GET /api/v1/travel-types rather than hardcoded a second time here
// where it could drift out of sync.
const FALLBACK = {
  travelTypes: [
    { id: 'adventure', label: 'Adventure' }, { id: 'nature', label: 'Nature' },
    { id: 'heritage', label: 'Heritage' }, { id: 'slow_travel', label: 'Slow Travel' },
    { id: 'budget', label: 'Budget' }, { id: 'wildlife', label: 'Wildlife' },
    { id: 'spiritual', label: 'Spiritual' }, { id: 'food', label: 'Food' },
    { id: 'nightlife', label: 'Nightlife' }, { id: 'photography', label: 'Photography' },
  ],
  preferredActivities: ['trekking', 'camping', 'photography', 'food', 'wildlife', 'heritage_walks', 'water_sports', 'cycling', 'spiritual_visits', 'shopping'],
  preferredPace: ['relaxed', 'balanced', 'fast_paced'],
  preferredGroupSize: ['solo', '2-3', '4-6', '7-10', '10+'],
  preferredTripDuration: ['1-2', '3-4', '5-7', '8+'],
}

let cached = null
let fetchPromise = null

function loadTravelTypes() {
  if (!fetchPromise) {
    fetchPromise = api.get('/v1/travel-types').then((res) => {
      cached = res.data
      return cached
    }).catch(() => {
      fetchPromise = null
      return null
    })
  }
  return fetchPromise
}

loadTravelTypes()

export function useTravelTypesTaxonomy() {
  const [taxonomy, setTaxonomy] = useState(cached || FALLBACK)
  useEffect(() => {
    if (cached) return // already reflected in useState's own initializer above
    let alive = true
    loadTravelTypes().then((t) => { if (alive && t) setTaxonomy(t) })
    return () => { alive = false }
  }, [])
  return taxonomy
}

export function activityLabel(id) {
  return String(id || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function paceLabel(id) {
  return { relaxed: 'Relaxed', balanced: 'Balanced', fast_paced: 'Fast-paced' }[id] || id
}
