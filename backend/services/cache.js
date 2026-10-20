/**
 * A tiny in-memory TTL cache.
 *
 * Used to avoid re-running the dashboard aggregation for every page view.
 * Each entry expires on its own and the store is capped so a long-lived
 * instance cannot grow without bound.
 *
 * Note: on serverless hosts the cache lives inside a single instance, so it
 * is a best-effort optimisation rather than a shared cache. A shared store
 * (Redis) is only needed well beyond the scale this app targets.
 */
const MAX_ENTRIES = Number(process.env.CACHE_MAX_ENTRIES || 500);

const store = new Map();

const get = (key) => {
    const entry = store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
        store.delete(key);
        return undefined;
    }
    // Refresh recency for the eviction order.
    store.delete(key);
    store.set(key, entry);
    return entry.value;
};

const set = (key, value, ttlMs) => {
    if (store.size >= MAX_ENTRIES) {
        // Evict the least recently used entry.
        const oldest = store.keys().next().value;
        if (oldest !== undefined) store.delete(oldest);
    }
    store.delete(key);
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
};

const del = (key) => store.delete(key);

const clear = () => store.clear();

const size = () => store.size;

module.exports = { get, set, del, clear, size };
