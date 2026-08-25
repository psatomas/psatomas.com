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
 */
export function createKvObservationCache(kv: KVNamespace): ObservationCache {
  return {
    async get(key) {
      const value = await kv.get<CachedObservation>(key, "json");
      return value ?? null;
    },
    async set(key, value, ttlMs) {
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
 * In-memory fallback for the rare case there's no Cloudflare context to
 * read a KV binding from at all (see route.ts). Plain `next dev` doesn't
 * need this fallback — next.config.ts's initOpenNextCloudflareForDev()
 * already emulates the KV binding there — so this exists purely as a
 * last resort to keep the route serving readings instead of failing.
 * It provides zero cross-isolate sharing (a plain module-scope Map), so
 * it is NOT what makes multi-client caching correct — the KV cache above
 * is; this only prevents a missing binding from taking the route down.
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
