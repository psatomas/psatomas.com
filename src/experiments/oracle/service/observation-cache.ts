import type { OracleObservation } from "../domain/model.ts";

/**
 * Shared storage for "the most recent observation this service obtained
 * from a given source+asset" — the layer that lets many concurrent
 * /api/oracle requests, across however many Cloudflare Worker isolates
 * happen to handle them, share one recent upstream fetch instead of each
 * independently re-contacting the source. Deliberately minimal: get/set
 * only, no query/list/delete — this is a cache, not a database (see
 * oracle-service.ts for the freshness/TTL logic built on top of it).
 */
export type CachedObservation = {
  observation: OracleObservation;
  /** Epoch ms — when the successful upstream fetch completed, not when the source
   * produced the observation (that's observation.observedAt). */
  cachedAt: number;
};

export interface ObservationCache {
  get(key: string): Promise<CachedObservation | null>;
  set(key: string, value: CachedObservation, ttlMs: number): Promise<void>;
}

/**
 * Cloudflare Workers KV-backed storage shared across isolates. KV is
 * eventually consistent, so concurrent isolates can still fetch/write
 * the same key. The service's refresh window reduces calls; it is not
 * a global rate limiter. Storage retention is longer than that window
 * so failed refreshes can use last-known-good observations. Every result
 * is evaluated against the current time, independent of retention.
 *
 * Takes a resolver rather than a `KVNamespace` directly, and calls it on
 * every get/set — never once at construction. `resolveKv` is what
 * actually reaches into `getCloudflareContext()` (see route.ts); under
 * `next dev` / `opennextjs-cloudflare preview`, Miniflare invalidates
 * ("poisons") every previously issued binding stub whenever it reloads
 * its runtime options, and this cache is built once and kept for an
 * isolate's whole lifetime (see route.ts's `servicePromise`). If it
 * closed over one `KVNamespace` captured at construction, that stub
 * would outlive a Miniflare reload and the next `.get()`/`.set()` would
 * throw. Resolving fresh per call costs nothing extra in a real
 * deployed Worker isolate, where the binding never changes anyway.
 */
export function createKvObservationCache(
  resolveKv: () => Promise<KVNamespace | undefined>,
): ObservationCache {
  return {
    async get(key) {
      const kv = await resolveKv();
      if (!kv) return null;
      const value = await kv.get<CachedObservation>(key, "json");
      return value ?? null;
    },
    async set(key, value, ttlMs) {
      const kv = await resolveKv();
      if (!kv) return;
      // Storage retention is independent of the service's 30s refresh
      // window. KV requires at least 60s retention.
      const expirationTtl = Math.max(60, Math.ceil(ttlMs / 1000));
      await kv.put(key, JSON.stringify(value), { expirationTtl });
    },
  };
}

/**
 * In-memory fallback — a plain module-scope Map, holding only observation
 * data (never a Cloudflare binding), so unlike the KV cache above it's
 * perfectly safe to build once and keep for an isolate's whole lifetime.
 * It provides zero cross-isolate sharing, so it is NOT what makes
 * multi-client caching correct — the KV cache above is; this only
 * prevents a missing binding from taking the route down.
 */
export function createInMemoryObservationCache(): ObservationCache {
  const store = new Map<string, { value: CachedObservation; expiresAt: number }>();
  return {
    async get(key) {
      const entry = store.get(key);
      if (!entry) return null;
      if (Date.now() >= entry.expiresAt) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    async set(key, value, ttlMs) {
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
    },
  };
}

/**
 * The cache route.ts actually uses: prefers the Cloudflare KV binding,
 * resolved fresh on every operation via `resolveKv` (see
 * createKvObservationCache above for why), falling back to a persistent
 * in-process Map when no binding is reachable at all — e.g. no
 * Cloudflare context reachable from the current call. That fallback Map
 * is created once and reused for every fallback operation, so it still
 * behaves like a real (if isolate-local, non-shared) cache rather than
 * silently caching nothing, but it holds only observation data, never a
 * binding, so keeping it for the composed cache's lifetime is safe.
 */
export function createResilientObservationCache(
  resolveKv: () => Promise<KVNamespace | undefined>,
): ObservationCache {
  const kvCache = createKvObservationCache(resolveKv);
  const fallback = createInMemoryObservationCache();

  return {
    async get(key) {
      const kv = await resolveKv();
      return kv ? kvCache.get(key) : fallback.get(key);
    },
    async set(key, value, ttlMs) {
      const kv = await resolveKv();
      return kv ? kvCache.set(key, value, ttlMs) : fallback.set(key, value, ttlMs);
    },
  };
}
