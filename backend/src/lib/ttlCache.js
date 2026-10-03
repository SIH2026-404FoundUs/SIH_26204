/**
 * A small in-process TTL + LRU cache.
 *
 * Deliberately dependency-free and per-process: this is a request-coalescing
 * layer in front of paid Google APIs, not a source of truth. A cold process,
 * a second dyno, or an eviction all just mean the next call goes to Google —
 * every consumer must still work correctly with a permanently empty cache.
 *
 * Entries expire lazily (on read) rather than on a timer, so an idle cache
 * holds no interval and keeps the process free to exit.
 */

/**
 * @param {object} options
 * @param {number} options.ttlMs        How long an entry stays fresh.
 * @param {number} [options.maxEntries] Hard cap on entry count (LRU eviction).
 * @param {number} [options.maxBytes]   Optional cap on total `sizeOf` weight.
 * @param {(value: any) => number} [options.sizeOf] Weight of one value; only
 *   consulted when maxBytes is set. Defaults to 1 (i.e. count, not bytes).
 */
export function createTtlCache({ ttlMs, maxEntries = 500, maxBytes = null, sizeOf = () => 1 } = {}) {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
    throw new Error('createTtlCache requires a positive ttlMs');
  }

  // Map preserves insertion order, which is what makes the LRU cheap: a read
  // deletes and re-inserts the key, so the oldest entry is always first.
  const entries = new Map();
  let totalBytes = 0;

  function drop(key) {
    const entry = entries.get(key);
    if (!entry) return;
    totalBytes -= entry.bytes;
    entries.delete(key);
  }

  function evictWhileOverCapacity() {
    while (entries.size > maxEntries || (maxBytes !== null && totalBytes > maxBytes)) {
      const oldest = entries.keys().next();
      if (oldest.done) break;
      drop(oldest.value);
    }
  }

  return {
    /** Returns the cached value, or undefined when absent or expired. */
    get(key) {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (Date.now() > entry.expiresAt) {
        drop(key);
        return undefined;
      }
      // Refresh recency.
      entries.delete(key);
      entries.set(key, entry);
      return entry.value;
    },

    set(key, value) {
      drop(key);
      const bytes = maxBytes === null ? 1 : Math.max(0, Number(sizeOf(value)) || 0);
      // A single value larger than the whole budget would evict everything
      // else and still not fit, so refuse to store it at all.
      if (maxBytes !== null && bytes > maxBytes) return value;
      entries.set(key, { value, bytes, expiresAt: Date.now() + ttlMs });
      totalBytes += bytes;
      evictWhileOverCapacity();
      return value;
    },

    delete: drop,

    clear() {
      entries.clear();
      totalBytes = 0;
    },
  };
}
