// Minimal stale-while-revalidate primitive: read what was last cached
// (render it immediately, no spinner) while a real fetch runs in the
// background and overwrites both the cache and the store once it resolves.
// Deliberately not a data library (no dedup/retry/invalidation graph) --
// just the one thing every polled screen in this app actually needs: don't
// block on a spinner when we already have something honest to show.
const PREFIX = 'sahyatri:swr:'

export function readCache(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function writeCache(key, data) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(data))
  } catch {
    // best-effort, per-device -- a full/blocked localStorage just means no cache, not a failure
  }
}
