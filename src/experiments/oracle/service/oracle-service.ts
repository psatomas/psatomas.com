import { evaluateReading } from "../domain/evaluate.ts";
import {
  defaultFreshnessPolicy,
  type AssetSymbol,
  type OracleFreshnessPolicy,
  type OracleObservation,
  type OracleReading,
} from "../domain/model.ts";
import type { OracleSourceAdapter } from "./oracle-source.ts";
import type { ObservationCache } from "./observation-cache.ts";

export interface OracleService {
  getReadings(asset: AssetSymbol): Promise<OracleReading[]>;
}

// How long a cached observation is served without re-contacting its
// source. This is the actual control on upstream request rate:
// regardless of how many /api/oracle requests arrive — one browser tab
// or a thousand — each source is contacted at most once per this window,
// per asset. 30s keeps the experiment feeling live while leaving a wide
// safety margin under CoinGecko's keyless ~10-30 calls/min budget (3
// assets × 2 calls/min ceiling = 6 calls/min, independent of how many
// people are viewing the page).
export const DEFAULT_CACHE_TTL_MS = 30_000;

export interface OracleServiceOptions {
  policy?: OracleFreshnessPolicy;
  /** Shared observation cache (see observation-cache.ts). Omitted in
   * tests that don't care about caching — behavior is then identical to
   * before this cache existed: every call fetches fresh. */
  cache?: ObservationCache;
  cacheTtlMs?: number;
}

export function createOracleService(
  adapters: OracleSourceAdapter[],
  options: OracleServiceOptions = {},
): OracleService {
  const { policy = defaultFreshnessPolicy, cache, cacheTtlMs = DEFAULT_CACHE_TTL_MS } = options;

  // Per-isolate in-flight de-dup: if two requests land on the same warm
  // Worker isolate while a fetch for the same source+asset is already in
  // progress, the second one awaits the first's result instead of
  // starting a redundant upstream call. This is a best-effort bonus on
  // top of the cache above, not the source of the cross-isolate
  // guarantee — a module-scope value is never reliably shared across
  // Cloudflare Worker instances, which is exactly why the cache exists.
  const inFlight = new Map<string, Promise<OracleObservation | null>>();

  async function getObservation(
    adapter: OracleSourceAdapter,
    asset: AssetSymbol,
    now: number,
  ): Promise<OracleObservation | null> {
    const key = `${adapter.id}:${asset}`;

    if (cache) {
      const cached = await cache.get(key).catch(() => null);
      if (cached && now - cached.cachedAt < cacheTtlMs) {
        return cached.observation;
      }
    }

    const existing = inFlight.get(key);
    if (existing) return existing;

    const promise = adapter
      .fetchObservation(asset)
      .then(async (observation) => {
        if (cache && observation) {
          // A cache-write failure must never fail the request — the
          // fresh observation fetched above is still valid and is
          // returned regardless; the next request simply falls back to
          // hitting the source again rather than reading a poisoned
          // cache entry.
          await cache.set(key, { observation, cachedAt: Date.now() }, cacheTtlMs).catch(() => {});
        }
        return observation;
      })
      .finally(() => {
        inFlight.delete(key);
      });

    inFlight.set(key, promise);
    return promise;
  }

  return {
    async getReadings(asset) {
      const now = Date.now();
      return Promise.all(
        adapters.map(async (adapter) => {
          try {
            const observation = await getObservation(adapter, asset, now);
            // Always evaluated against the current `now`, whether the
            // observation just came from the source or from the cache —
            // this is what keeps latency/freshness/status honest for a
            // cached value instead of freezing them at cache-write time.
            return evaluateReading(adapter.id, asset, observation, now, policy);
          } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            return evaluateReading(adapter.id, asset, null, now, policy, reason);
          }
        }),
      );
    },
  };
}
