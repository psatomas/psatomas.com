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
  /** Epoch ms — when this service wrote this entry, not when the source
   * produced the observation (that's observation.observedAt). */
  cachedAt: number;
};

export interface ObservationCache {
  get(key: string): Promise<CachedObservation | null>;
  set(key: string, value: CachedObservation, ttlMs: number): Promise<void>;
}

/**
 * Cloudflare Workers KV-backed implementation — the actual cross-isolate,
 * cross-request shared cache, and what makes this correct in production.
 * KV is eventually consistent (Cloudflare's docs: a write can take up to
 * ~60s to be visible everywhere) and its own guidance is to avoid writing
 * the same key more than about once/second. Both are fine for this use:
 * a write only happens at most once per cacheTtlMs per source+asset (see
 * DEFAULT_CACHE_TTL_MS in oracle-service.ts — tens of seconds, not
 * per-request), and a briefly-stale read during propagation just costs an
 * occasional extra upstream call, never incorrect data — every reading is
 * still evaluated fresh against the current time by evaluateReading, so a
 * cached observation that has actually aged out is still reported as such
 * rather than presented as live.
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
      // KV enforces a minimum expirationTtl of 60s and rejects anything
      // shorter — round up so a tighter in-code freshness window (e.g.
      // 30s) never throws here. The actual "is this fresh enough to
      // serve" decision still happens on read in oracle-service.ts using
      // the real ttlMs; this is only how long KV retains the entry at
      // all before evicting it outright.
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
  const store = new Map<string, CachedObservation>();
  return {
    async get(key) {
      return store.get(key) ?? null;
    },
    async set(key, value) {
      store.set(key, value);
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
