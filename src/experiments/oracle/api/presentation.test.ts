import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceReading, readingConnection } from "./presentation.ts";
import { evaluateReading } from "../domain/evaluate.ts";
import { defaultFreshnessPolicy } from "../domain/model.ts";

const baseline = {
  ...evaluateReading("coingecko", "ETH/USD", {
    asset: "ETH/USD", value: 1, unit: "USD", observedAt: 830_000,
  }, 1_000_000, defaultFreshnessPolicy),
  fetchedAt: 990_000,
  delivery: "FALLBACK" as const,
  refreshError: "",
};

for (const skew of [-600_000, 600_000]) {
  test(`monotonic aging ignores browser wall-clock skew ${skew}ms`, (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: 1_000_000 + skew });
    for (const [elapsed, freshness] of [[0, "FRESH"], [10_000, "FRESH"],
      [10_001, "AGING"], [130_000, "AGING"], [130_001, "STALE"]] as const) {
      const reading = advanceReading(baseline, elapsed);
      assert.equal(reading.freshness, freshness);
      assert.equal(reading.latencyMs, 170_000 + elapsed);
      assert.equal(reading.observation?.observedAt, baseline.observation?.observedAt);
      assert.equal(reading.fetchedAt, baseline.fetchedAt);
      assert.equal(reading.retrievedAt, baseline.retrievedAt);
      assert.equal(readingConnection(reading), "DEGRADED", "empty error must not hide fallback");
    }
  });
}

test("presentation distinguishes successful cache delivery, missing data, and fallback", () => {
  assert.equal(readingConnection({ ...baseline, delivery: "CACHE" }), "OK");
  assert.equal(readingConnection({ ...baseline, delivery: "UPSTREAM" }), "OK");
  const absent = { ...baseline, observation: null, latencyMs: null, status: "UNAVAILABLE" as const };
  assert.equal(readingConnection(absent), "ERROR");
  assert.deepEqual(advanceReading(absent, 60_000), absent);
  assert.deepEqual(advanceReading(baseline, -1), baseline);
});
