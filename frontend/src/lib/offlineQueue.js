import api, { getErrorMessage } from './api'

const QUEUE_KEY = 'sahyatri:offline-queue'

function readQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY)) || []
  } catch {
    return []
  }
}

function writeQueue(queue) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
  } catch {
    // best-effort, per-device -- a full/blocked localStorage just means no queue, not a crash
  }
}

// A write that gets queued instead of failing when there's genuinely no
// connectivity (navigator.onLine false AND the request itself came back
// with no response at all -- never queues a real 4xx/5xx from a server
// that IS reachable, since retrying that wouldn't help). Queued entries
// persist across a reload/app-close and replay automatically the moment
// the browser fires 'online', in the order they were queued.
export async function sendOrQueue({ method, url, data, label }) {
  try {
    const res = await api.request({ method, url, data })
    return { ok: true, data: res.data, queued: false }
  } catch (error) {
    const noResponse = !error.response
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false
    if (noResponse && offline) {
      const queue = readQueue()
      queue.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        method,
        url,
        data,
        label,
        createdAt: new Date().toISOString(),
      })
      writeQueue(queue)
      return { ok: true, data: null, queued: true }
    }
    return { ok: false, error, message: getErrorMessage(error) }
  }
}

export function getQueuedActions() {
  return readQueue()
}

let flushing = false

// Replays queued writes in order. Stops at the first one that still fails
// for connectivity reasons (still offline, or a flaky reconnect) so
// ordering is preserved for next time; a request that comes back with a
// real server response (success OR a genuine 4xx/5xx) is removed from the
// queue either way -- retrying a rejection forever wouldn't fix it.
export async function flushQueue() {
  if (flushing) return
  flushing = true
  try {
    let queue = readQueue()
    for (const item of queue) {
      try {
        await api.request({ method: item.method, url: item.url, data: item.data })
      } catch (error) {
        if (!error.response) break // still no real connectivity -- leave the rest queued
      }
      queue = queue.filter((q) => q.id !== item.id)
      writeQueue(queue)
    }
  } finally {
    flushing = false
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { flushQueue() })
}
