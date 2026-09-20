import { create } from 'zustand'

const STORAGE_KEY = 'sahyatri:data-saver'

// Defaults ON for a genuinely slow/metered connection (Chrome's own Data
// Saver signal, or a detected 2G/slow-2G link) -- the native Network
// Information API, no new dependency. A manual choice the traveller makes
// afterwards always wins over that guess, persisted so it survives a
// reload instead of re-guessing every visit.
function detectSlowConnection() {
  const conn = typeof navigator !== 'undefined' && navigator.connection
  if (!conn) return false
  if (conn.saveData) return true
  return ['slow-2g', '2g'].includes(conn.effectiveType)
}

function readStoredPreference() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw === null ? null : raw === 'true'
  } catch {
    return null
  }
}

export const useDataSaverStore = create((set, get) => ({
  enabled: readStoredPreference() ?? detectSlowConnection(),

  toggle: () => {
    const next = !get().enabled
    set({ enabled: next })
    try { localStorage.setItem(STORAGE_KEY, String(next)) } catch { /* best-effort, per-device */ }
  },
}))
