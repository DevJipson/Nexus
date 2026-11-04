import { describe, expect, it, vi } from "vitest";
import { createTtlCache } from "../src/lib/cache";

describe("ttl cache", () => {
  it("caches values within the TTL and expires them after", async () => {
    let current = 1_000;
    const cache = createTtlCache<string>({ ttlMs: 100, now: () => current });

    let loads = 0;
    const loader = async () => {
      loads += 1;
      return `value-${loads}`;
    };

    expect(await cache.getOrLoad("k", loader)).toBe("value-1");
    expect(await cache.getOrLoad("k", loader)).toBe("value-1");
    expect(loads).toBe(1);

    current += 150;
    expect(await cache.getOrLoad("k", loader)).toBe("value-2");
    expect(loads).toBe(2);
  });

  it("evicts the oldest entry when maxEntries is exceeded", async () => {
    const cache = createTtlCache<number>({ ttlMs: 10_000, maxEntries: 2 });
    await cache.getOrLoad("a", async () => 1);
    await cache.getOrLoad("b", async () => 2);
    await cache.getOrLoad("c", async () => 3);

    expect(await cache.get("a")).toBeUndefined();
    expect(await cache.get("b")).toBe(2);
    expect(await cache.get("c")).toBe(3);
  });

  it("supports explicit invalidation", async () => {
    const cache = createTtlCache<string>({ ttlMs: 10_000 });
    await cache.getOrLoad("k", async () => "v");
    cache.invalidate("k");
    expect(await cache.get("k")).toBeUndefined();
  });

  it("returns undefined when the loader rejects", async () => {
    const logger = { error: vi.fn() } as unknown as Parameters<typeof createTtlCache<string>>[0]["logger"];
    const cache = createTtlCache<string>({ ttlMs: 10_000, logger });
    const value = await cache.getOrLoad("k", async () => {
      throw new Error("boom");
    });
    expect(value).toBeUndefined();
  });
});
