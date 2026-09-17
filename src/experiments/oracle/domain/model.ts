/**
 * Oracle domain model — the data shapes this boundary produces and
 * evaluates. Pure data only; nothing here knows about React, HTTP, or any
 * particular data source.
 */

export type OracleSourceId = string;

/**
 * e.g. "ETH/USD". Kept as a plain string (not a union) — Phase 1 only
 * has one asset in play, but nothing here assumes there will only ever
 * be one.
 */
export type AssetSymbol = string;

/**
 * A single fact reported by one source: "this source said the value was
 * X, at this time." Nothing here says whether it's fresh, valid, or
 * usable — that's evaluated separately (see evaluate.ts), because the
 * same raw observation can be judged differently under different
 * policies (e.g. a stricter protocol vs. a looser one).
 */
export type OracleObservation = {
  asset: AssetSymbol;
  value: number;
  /** Unit the value is denominated in, kept explicit rather than assumed. */
  unit: string;
  /** Epoch ms — when the source produced this reading. */
  observedAt: number;
};

export type OracleFreshness = "FRESH" | "AGING" | "STALE";

/**
 * INVALID exists for a future adapter that can detect a malformed or
 * unverifiable observation (e.g. a bad signature) — nothing in Phase 1
 * produces it yet; there's no real attestation to check.
 */
export type OracleStatus = "OK" | "STALE" | "INVALID" | "UNAVAILABLE";

/**
 * The result of evaluating one source's observation (or lack of one)
 * against a freshness policy, at a point in time. This is what the
 * service and API hand back — never a raw OracleObservation on its own,
 * since "is this usable" is always the point.
 */
export type OracleReading = {
  source: OracleSourceId;
  asset: AssetSymbol;
  observation: OracleObservation | null;
  /** Epoch ms — when the service evaluated this reading, including cache hits. */
  retrievedAt: number;
  /** retrievedAt − observation.observedAt, or null when unavailable. */
  latencyMs: number | null;
  /** Delivery provenance is separate from observation freshness. */
  delivery?: "UPSTREAM" | "CACHE" | "FALLBACK";
  /** Last successful upstream retrieval; never advanced by fallback. */
  fetchedAt?: number;
  refreshError?: string;
  freshness: OracleFreshness | null;
  status: OracleStatus;
  reason: string;
};

export type OracleFreshnessPolicy = {
  /** At or below this age, a reading is FRESH. */
  freshAfterMs: number;
  /** Above freshAfterMs but at or below this, a reading is AGING.
   * Beyond it, STALE. */
  maxAgeMs: number;
};

export const defaultFreshnessPolicy: OracleFreshnessPolicy = {
  // Keyless observations measured at 146–179s old on 2026-09-17.
  // Accommodate those response ages; flag the next 2 minutes AGING,
  // then STALE. This is an experiment policy, not a provider SLA.
  freshAfterMs: 180_000,
  maxAgeMs: 300_000,
};
