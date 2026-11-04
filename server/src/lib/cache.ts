import type { Pool } from "pg";
import type { Logger } from "./logger";

/**
 * Cache-aside helper for slow-changing lookups (active workspace validation,
 * feature flags, rate-limit policy). Keeps a bounded in-memory map with a TTL
 * so reads do not require a query on every request.
 *
 * Deliberately simple: single-process, best-effort. Multi-instance deployments
 * (or anything requiring cross-node consistency) must move to Redis — the same
 * boundary called out for presence and rate limiting in the plan (D10).
 */
export interface TtlCache<T> {
  get(key: string): Promise<T | undefined>;
  /** Returns the cached value (populating it if needed); returns undefined on loader failure. */
  getOrLoad(key: string, loader: () => Promise<T>): Promise<T | undefined>;
  invalidate(key: string): void;
  clear(): void;
}

export function createTtlCache<T>(options: {
  ttlMs: number;
  maxEntries?: number;
  logger?: Logger;
  now?: () => number;
}): TtlCache<T> {
  const { ttlMs, maxEntries = 1_000, logger } = options;
  const now = options.now ?? (() => Date.now());
  const entries = new Map<string, { value: T; expiresAt: number }>();

  const read = (key: string): T | undefined => {
    const entry = entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= now()) {
      entries.delete(key);
      return undefined;
    }
    return entry.value;
  };

  const write = (key: string, value: T): void => {
    if (entries.size >= maxEntries) {
      const oldest = entries.keys().next().value;
      if (oldest !== undefined) entries.delete(oldest);
    }
    entries.set(key, { value, expiresAt: now() + ttlMs });
  };

  return {
    get: async (key) => read(key),
    async getOrLoad(key, loader) {
      const cached = read(key);
      if (cached !== undefined) return cached;
      try {
        const value = await loader();
        write(key, value);
        return value;
      } catch (error) {
        logger?.error({ err: error, key }, "cache loader failed");
        return undefined;
      }
    },
    invalidate: (key) => {
      entries.delete(key);
    },
    clear: () => {
      entries.clear();
    },
  };
}

// Re-exported for consumers that only need the type shape.
export type { Pool };
