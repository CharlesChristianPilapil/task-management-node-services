type CacheEntry<T> = {
    value: T;
    expiresAt: number;
};

const CACHE_TTL_MS = 3_600_000;
const CACHE_MAX_SIZE = 500;

const store = new Map<string, CacheEntry<unknown>>();

const evictExpired = (): void => {
    const now = Date.now();

    for (const [key, entry] of store.entries()) {
        if (now >= entry.expiresAt) {
            store.delete(key);
        }
    }
};

const evictOldest = (): void => {
    const oldest = store.keys().next().value;

    if (oldest !== undefined) {
        store.delete(oldest);
    }
};

export const cacheService = {
    ttlMs: CACHE_TTL_MS,

    get: <T>(key: string): T | null => {
        const entry = store.get(key);

        if (!entry) return null;

        if (Date.now() >= entry.expiresAt) {
            store.delete(key);
            return null;
        }

        return entry.value as T;
    },

    set: <T>(key: string, value: T, ttlMs = CACHE_TTL_MS): void => {
        if (store.size >= CACHE_MAX_SIZE) {
            evictExpired();

            if (store.size >= CACHE_MAX_SIZE) {
                evictOldest();
            }
        }

        store.set(key, {
            value,
            expiresAt: Date.now() + ttlMs,
        });
    },

    delete: (key: string): boolean => {
        return store.delete(key);
    },

    clear: (): void => {
        store.clear();
    },

    size: (): number => {
        return store.size;
    },
};