import { evaluateReading } from "../domain/evaluate.ts";
import { defaultFreshnessPolicy, type OracleReading } from "../domain/model.ts";

/** Elapsed time comes from performance.now(), never the browser wall clock. */
export function advanceReading(reading: OracleReading, elapsedMs: number): OracleReading {
  if (!reading.observation || reading.latencyMs == null || elapsedMs <= 0) return reading;
  const evaluated = evaluateReading(
    reading.source, reading.asset, reading.observation,
    reading.observation.observedAt + reading.latencyMs + elapsedMs,
    defaultFreshnessPolicy,
  );
  return {
    ...reading,
    latencyMs: evaluated.latencyMs,
    freshness: evaluated.freshness,
    status: evaluated.status,
    reason: evaluated.reason,
  };
}

export function readingConnection(reading: OracleReading): "OK" | "DEGRADED" | "STALE" | "ERROR" {
  if (!reading.observation || reading.status === "UNAVAILABLE") return "ERROR";
  if (reading.delivery === "FALLBACK") return "DEGRADED";
  return reading.status === "STALE" ? "STALE" : "OK";
}
