import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateReading } from "./evaluate.ts";
import { defaultFreshnessPolicy, type OracleObservation } from "./model.ts";

const now = 1_000_000;

function observationAge(ageMs: number): OracleObservation {
  return { asset: "ETH/USD", value: 100, unit: "USD", observedAt: now - ageMs };
}

test("observation within freshAfterMs is OK/FRESH", () => {
  const reading = evaluateReading(
    "test-source",
    "ETH/USD",
    observationAge(1_000),
    now,
    defaultFreshnessPolicy,
  );
  assert.equal(reading.status, "OK");
  assert.equal(reading.freshness, "FRESH");
  assert.equal(reading.latencyMs, 1_000);
  assert.equal(reading.observation?.value, 100);
});

test("observation between freshAfterMs and maxAgeMs is OK/AGING", () => {
  const reading = evaluateReading(
    "test-source",
    "ETH/USD",
    observationAge(240_000),
    now,
    defaultFreshnessPolicy,
  );
  assert.equal(reading.status, "OK");
  assert.equal(reading.freshness, "AGING");
});

test("observation beyond maxAgeMs is rejected as STALE", () => {
  const reading = evaluateReading(
    "test-source",
    "ETH/USD",
    observationAge(360_000),
    now,
    defaultFreshnessPolicy,
  );
  assert.equal(reading.status, "STALE");
  assert.equal(reading.freshness, "STALE");
});

test("missing observation evaluates to UNAVAILABLE, not a thrown error", () => {
  const reading = evaluateReading("test-source", "ETH/USD", null, now, defaultFreshnessPolicy);
  assert.equal(reading.status, "UNAVAILABLE");
  assert.equal(reading.observation, null);
  assert.equal(reading.latencyMs, null);
  assert.equal(reading.freshness, null);
});

test("deterministic: identical inputs always produce identical output", () => {
  const observation = observationAge(1_000);
  const a = evaluateReading("s", "ETH/USD", observation, now, defaultFreshnessPolicy);
  const b = evaluateReading("s", "ETH/USD", observation, now, defaultFreshnessPolicy);
  assert.deepEqual(a, b);
});

for (const [age, freshness] of [
  [120_000, "FRESH"], [179_000, "FRESH"], [180_000, "FRESH"],
  [180_001, "AGING"], [300_000, "AGING"], [300_001, "STALE"],
] as const) {
  test(`default policy classifies ${age}ms as ${freshness}`, () => {
    const reading = evaluateReading("coingecko", "ETH/USD", observationAge(age), now, defaultFreshnessPolicy);
    assert.equal(reading.freshness, freshness);
    assert.equal(reading.status, freshness === "STALE" ? "STALE" : "OK");
  });
}
