import type {
  AssetSymbol,
  OracleFreshness,
  OracleFreshnessPolicy,
  OracleObservation,
  OracleReading,
  OracleSourceId,
  OracleStatus,
} from "./model.ts";

function freshnessFor(ageMs: number, policy: OracleFreshnessPolicy): OracleFreshness {
  if (ageMs <= policy.freshAfterMs) return "FRESH";
  if (ageMs <= policy.maxAgeMs) return "AGING";
  return "STALE";
}

/**
 * Pure: evaluates one source's observation (or absence of one) into an
 * OracleReading. Same inputs always produce the same output — no clock
 * reads, no randomness. The caller supplies `now` explicitly (see
 * service/oracle-service.ts), which is what keeps this function testable
 * and keeps "what time is it" a service-level concern, not a domain one.
 */
export function evaluateReading(
  source: OracleSourceId,
  asset: AssetSymbol,
  observation: OracleObservation | null,
  now: number,
  policy: OracleFreshnessPolicy,
): OracleReading {
  if (!observation) {
    return {
      source,
      asset,
      observation: null,
      retrievedAt: now,
      latencyMs: null,
      freshness: null,
      status: "UNAVAILABLE",
      reason: `${source} produced no observation for ${asset}`,
    };
  }

  const latencyMs = now - observation.observedAt;
  const freshness = freshnessFor(latencyMs, policy);
  const status: OracleStatus = freshness === "STALE" ? "STALE" : "OK";
  const ageSeconds = Math.round(latencyMs / 1000);
  const reason =
    status === "STALE"
      ? `STALE — ${ageSeconds}s old, exceeds ${Math.round(policy.maxAgeMs / 1000)}s window`
      : `${freshness} — ${ageSeconds}s old`;

  return {
    source,
    asset,
    observation,
    retrievedAt: now,
    latencyMs,
    freshness,
    status,
    reason,
  };
}
