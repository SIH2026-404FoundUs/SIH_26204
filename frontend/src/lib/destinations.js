import { useEffect, useState } from 'react'
import api from './api'

// GET /api/destinations now serves the full seeded set (200 places across 8
// states) -- this used to be a static mirror of just Himachal Pradesh/
// Telangana because no list endpoint existed yet. Fetched once per page
// load and cached; FALLBACK_DESTINATION_GROUPS below only covers the case
// where that request hasn't resolved yet (or fails), so a picker never
// renders empty.
const FALLBACK_DESTINATION_GROUPS = [
  {
    state: 'Himachal Pradesh',
    destinations: [
      { id: 'manali', label: 'Manali' },
      { id: 'shimla', label: 'Shimla' },
      { id: 'kasauli', label: 'Kasauli' },
      { id: 'dalhousie', label: 'Dalhousie' },
      { id: 'khajjiar', label: 'Khajjiar' },
      { id: 'dharamshala', label: 'Dharamshala' },
      { id: 'mcleodganj', label: 'McLeod Ganj' },
      { id: 'kasol', label: 'Kasol' },
      { id: 'tosh', label: 'Tosh' },
      { id: 'jibhi', label: 'Jibhi' },
      { id: 'tirthan-valley', label: 'Tirthan Valley' },
      { id: 'bir-billing', label: 'Bir Billing' },
      { id: 'palampur', label: 'Palampur' },
      { id: 'chail', label: 'Chail' },
      { id: 'kalpa', label: 'Kalpa, Kinnaur' },
      { id: 'chhitkul', label: 'Chhitkul, Kinnaur' },
      { id: 'naggar', label: 'Naggar' },
      { id: 'solan', label: 'Solan' },
      { id: 'spiti-kaza', label: 'Kaza, Spiti Valley' },
      { id: 'mandi', label: 'Mandi' },
    ],
  },
  {
    state: 'Telangana',
    destinations: [
      { id: 'yadapalli-yadadri', label: 'Yadadri, Bhuvanagiri' },
      { id: 'ramappa-temple', label: 'Ramappa Temple, Mulugu' },
      { id: 'thousand-pillar-temple', label: 'Thousand Pillar Temple, Hanamkonda' },
      { id: 'warangal-fort', label: 'Warangal Fort' },
      { id: 'bhadrachalam', label: 'Bhadrachalam' },
      { id: 'charminar-hyderabad', label: 'Charminar, Hyderabad' },
      { id: 'golconda-hyderabad', label: 'Golconda Fort, Hyderabad' },
      { id: 'hussain-sagar-hyderabad', label: 'Hussain Sagar, Hyderabad' },
      { id: 'nagarjuna-sagar', label: 'Nagarjuna Sagar, Nalgonda' },
      { id: 'medak-church', label: 'Medak Cathedral' },
      { id: 'alampur-jogulamba', label: 'Alampur, Jogulamba Gadwal' },
      { id: 'ananthagiri-hills', label: 'Ananthagiri Hills, Vikarabad' },
      { id: 'bogatha-waterfalls', label: 'Bogatha Waterfalls' },
      { id: 'kondagattu', label: 'Kondagattu, Jagtial' },
      { id: 'kuntala-waterfalls', label: 'Kuntala Waterfalls, Adilabad' },
      { id: 'laknavaram-lake', label: 'Laknavaram Lake, Mulugu' },
    ],
  },
]

const FALLBACK_LOOKUP = new Map(
  FALLBACK_DESTINATION_GROUPS.flatMap((g) => g.destinations.map((d) => [d.id, d.label]))
)

// "tirthan-valley" -> "Tirthan Valley" as a last resort for anything not in
// the table above (a new seed destination, a typo'd id, etc.) so the UI never
// shows a raw slug even in that case.
function humanizeSlug(id) {
  return String(id || '')
    .split('-')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

// displayName is "Place, Full State Name" -- d.state is only an abbreviation
// code (e.g. "HP", "TG"), unfit for a group heading, so the full name is
// pulled from displayName's own suffix instead of hardcoding a code->name map.
function stateNameFromDisplayName(displayName) {
  const parts = String(displayName || '').split(',')
  return parts.length > 1 ? parts[parts.length - 1].trim() : ''
}

function toGroups(items) {
  const byState = new Map()
  for (const d of items) {
    const key = stateNameFromDisplayName(d.displayName) || d.state || 'Other'
    if (!byState.has(key)) byState.set(key, [])
    byState.get(key).push({ id: d.id, label: d.displayName })
  }
  return [...byState.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([state, destinations]) => ({
      state,
      destinations: destinations.sort((a, b) => a.label.localeCompare(b.label)),
    }))
}

let cachedGroups = null
let cachedLookup = FALLBACK_LOOKUP
let cachedItemsById = new Map()
let fetchPromise = null

function loadDestinations() {
  if (!fetchPromise) {
    fetchPromise = api.get('/destinations').then((res) => {
      const items = res.data?.data || []
      cachedGroups = toGroups(items)
      cachedLookup = new Map(items.map((d) => [d.id, d.displayName]))
      cachedItemsById = new Map(items.map((d) => [d.id, d]))
      return cachedGroups
    }).catch(() => {
      fetchPromise = null // allow a retry on the next call/render
      return null
    })
  }
  return fetchPromise
}

loadDestinations() // kick off on first import so labels resolve ASAP app-wide

// The full grouped list for pickers -- starts as the fallback and swaps to
// the real 200-destination list once the fetch resolves.
export function useDestinationGroups() {
  const [groups, setGroups] = useState(cachedGroups || FALLBACK_DESTINATION_GROUPS)
  useEffect(() => {
    if (cachedGroups) return // already reflected in useState's own initializer above
    let alive = true
    loadDestinations().then((g) => { if (alive && g) setGroups(g) })
    return () => { alive = false }
  }, [])
  return groups
}

export function getDestinationLabel(destId) {
  if (!destId) return 'Unknown destination'
  return cachedLookup.get(destId) || FALLBACK_LOOKUP.get(destId) || humanizeSlug(destId)
}

// Travel Education packs (offline destination facts): the structured
// fields the seed already carries -- attrs, baseline visitor/price/rail
// data, nearest airport/railhead, road access -- never invented prose.
// Downloaded once, stored as plain JSON in localStorage, readable with no
// network at all afterward. Deliberately not the live pressure score
// (that's a live signal, caching it would be dishonest the moment it goes
// stale) -- just the facts about the place that don't change day to day.
const PACK_PREFIX = 'sahyatri:edu-pack:'

export async function getDestinationFacts(destId) {
  if (!cachedItemsById.has(destId)) await loadDestinations()
  return cachedItemsById.get(destId) || null
}

export async function downloadEducationPack(destId) {
  const facts = await getDestinationFacts(destId)
  if (!facts) return false
  try {
    localStorage.setItem(PACK_PREFIX + destId, JSON.stringify({ ...facts, downloadedAt: new Date().toISOString() }))
    return true
  } catch {
    return false // full/blocked localStorage -- nothing to do but report it didn't save
  }
}

export function readEducationPack(destId) {
  try {
    const raw = localStorage.getItem(PACK_PREFIX + destId)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function hasEducationPack(destId) {
  try {
    return localStorage.getItem(PACK_PREFIX + destId) !== null
  } catch {
    return false
  }
}
