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

// Refresh cadence, not observation freshness or storage retention.
// KV sharing and per-isolate coalescing reduce calls, but eventual
// consistency means this is not a global rate-limit guarantee.
export const DEFAULT_CACHE_TTL_MS = 30_000;
// Keep last-known-good data for outages, without calling it usable/live.
// Failures never rewrite the entry or extend this retention window.
export const CACHE_RETENTION_MS = 3_600_000;
const MAX_RETRY_DELAY_MS = 60_000;

type ObservationResult = {
  observation: OracleObservation | null;
  delivery: "UPSTREAM" | "CACHE" | "FALLBACK";
  fetchedAt?: number;
  refreshError?: string;
};

export interface OracleServiceOptions {
  policy?: OracleFreshnessPolicy;
  cache?: ObservationCache;
  cacheTtlMs?: number;
}

export function createOracleService(
  adapters: OracleSourceAdapter[],
  options: OracleServiceOptions = {},
): OracleService {
  const { policy = defaultFreshnessPolicy, cache, cacheTtlMs = DEFAULT_CACHE_TTL_MS } = options;
  const inFlight = new Map<string, Promise<ObservationResult>>();
  // Demand-driven, per-isolate backoff: no background retries or timers.
  // Failure state contains no observation and cannot refresh its timestamp.
  const failures = new Map<string, { reason: string; retryAt: number; delay: number }>();

  async function getObservation(
    adapter: OracleSourceAdapter,
    asset: AssetSymbol,
  ): Promise<ObservationResult> {
    const key = `${adapter.id}:${asset}`;
    const cached = await cache?.get(key).catch(() => null);
    const now = Date.now();
    if (cached && now - cached.cachedAt < cacheTtlMs) {
      return { observation: cached.observation, fetchedAt: cached.cachedAt, delivery: "CACHE" };
    }

    function fallback(reason: string): ObservationResult {
      return {
        observation: cached?.observation ?? null,
        fetchedAt: cached?.cachedAt,
        delivery: "FALLBACK",
        refreshError: reason,
      };
    }

    const existing = inFlight.get(key);
    if (existing) return existing;
    const failure = failures.get(key);
    if (failure && now < failure.retryAt) return fallback(failure.reason);

    const promise = (async (): Promise<ObservationResult> => {
      try {
        const observation = await adapter.fetchObservation(asset);
        if (!observation) throw new Error(`${adapter.id} produced no observation for ${asset}`);
        const fetchedAt = Date.now();
        failures.delete(key);
        if (cache) {
          // A storage failure must not discard a successful upstream response.
          await cache.set(key, { observation, cachedAt: fetchedAt }, CACHE_RETENTION_MS).catch(() => {});
        }
        return { observation, fetchedAt, delivery: "UPSTREAM" };
      } catch {
        // Never serialize arbitrary adapter/runtime exception details.
        const reason = "The source could not provide an observation.";
        const delay = Math.min(MAX_RETRY_DELAY_MS, failure ? failure.delay * 2 : DEFAULT_CACHE_TTL_MS);
        // Bound memory even for arbitrary unsupported asset query strings.
        if (failures.size >= 256) failures.delete(failures.keys().next().value!);
        failures.set(key, { reason, delay, retryAt: Date.now() + delay });
        return fallback(reason);
      }
    })().finally(() => inFlight.delete(key));

    inFlight.set(key, promise);
    return promise;
  }

  return {
    async getReadings(asset) {
      const results = await Promise.all(adapters.map((adapter) => getObservation(adapter, asset)));
      const now = Date.now();
      return results.map((original, index) => {
        const adapter = adapters[index];
        const result = { ...original };
        // Recheck after awaiting refresh/coalescing: storage may have expired
        // since get() returned. The successful fetch remains the lifetime origin.
        if (result.delivery !== "UPSTREAM" && result.observation &&
            (result.fetchedAt == null || now >= result.fetchedAt + CACHE_RETENTION_MS)) {
          result.observation = null;
          result.fetchedAt = undefined;
        }
        // Evaluate after refresh completes, never at cache-write/request-start time.
        const reading = evaluateReading(
          adapter.id, asset, result.observation, now, policy, result.refreshError,
        );
        return {
          ...reading,
          delivery: result.delivery,
          fetchedAt: result.fetchedAt,
          refreshError: result.refreshError,
        };
      });
    },
  };
}
