import { test } from "node:test";
import assert from "node:assert/strict";
import { createOracleService } from "./oracle-service.ts";
import { createDevOracleAdapter } from "./dev-adapter.ts";
import { createInMemoryObservationCache } from "./observation-cache.ts";
import type { OracleSourceAdapter } from "./oracle-source.ts";

/** Counts real fetchObservation calls so tests can assert on upstream
 * call volume directly, rather than inferring it from timing. */
function countingAdapter(id: string): { adapter: OracleSourceAdapter; calls: () => number } {
  let calls = 0;
  return {
    adapter: {
      id,
      async fetchObservation(asset) {
        calls++;
        return { asset, value: 100, unit: "USD", observedAt: Date.now() };
      },
    },
    calls: () => calls,
  };
}

test("dev adapter produces one OK reading for the asset it supports", async () => {
  const service = createOracleService([createDevOracleAdapter()]);
  const readings = await service.getReadings("ETH/USD");
  assert.equal(readings.length, 1);
  assert.equal(readings[0].status, "OK");
  assert.equal(readings[0].source, "dev-fixture");
});

test("an unsupported asset yields UNAVAILABLE, not a thrown error", async () => {
  const service = createOracleService([createDevOracleAdapter()]);
  const readings = await service.getReadings("BTC/USD");
  assert.equal(readings[0].status, "UNAVAILABLE");
});

test("orchestrates multiple independent adapters — one down doesn't affect the other", async () => {
  const healthy: OracleSourceAdapter = {
    id: "source-ok",
    async fetchObservation(asset) {
      return { asset, value: 1, unit: "USD", observedAt: Date.now() };
    },
  };
  const down: OracleSourceAdapter = {
    id: "source-down",
    async fetchObservation() {
      return null;
    },
  };

  const service = createOracleService([healthy, down]);
  const readings = await service.getReadings("ETH/USD");

  assert.equal(readings.length, 2);
  assert.equal(readings.find((r) => r.source === "source-ok")?.status, "OK");
  assert.equal(readings.find((r) => r.source === "source-down")?.status, "UNAVAILABLE");
});

test("an adapter that throws is represented as UNAVAILABLE, not a rejected service call", async () => {
  const throwing: OracleSourceAdapter = {
    id: "source-throws",
    async fetchObservation() {
      throw new Error("simulated network failure");
    },
  };

  const service = createOracleService([throwing]);
  const readings = await service.getReadings("ETH/USD");

  assert.equal(readings[0].status, "UNAVAILABLE");
  assert.match(readings[0].reason, /simulated network failure/);
});

test("with a cache, a second read within the TTL window reuses the cached observation instead of re-fetching", async () => {
  const { adapter, calls } = countingAdapter("source-ok");
  const service = createOracleService([adapter], {
    cache: createInMemoryObservationCache(),
    cacheTtlMs: 30_000,
  });

  await service.getReadings("ETH/USD");
  await service.getReadings("ETH/USD");
  await service.getReadings("ETH/USD");

  assert.equal(calls(), 1, "3 reads within the TTL window should cause exactly 1 upstream call");
});

test("concurrent reads that arrive at the same time coalesce into one upstream call", async () => {
  const { adapter, calls } = countingAdapter("source-ok");
  const service = createOracleService([adapter], {
    cache: createInMemoryObservationCache(),
    cacheTtlMs: 30_000,
  });

  const [a, b, c] = await Promise.all([
    service.getReadings("ETH/USD"),
    service.getReadings("ETH/USD"),
    service.getReadings("ETH/USD"),
  ]);

  assert.equal(calls(), 1, "3 concurrent reads should coalesce into exactly 1 upstream call");
  assert.equal(a[0].observation?.value, b[0].observation?.value);
  assert.equal(b[0].observation?.value, c[0].observation?.value);
});

test("a cached observation past the TTL window triggers exactly one fresh upstream call", async () => {
  const { adapter, calls } = countingAdapter("source-ok");
  const cache = createInMemoryObservationCache();
  const service = createOracleService([adapter], { cache, cacheTtlMs: 10 });

  await service.getReadings("ETH/USD");
  assert.equal(calls(), 1);

  await new Promise((resolve) => setTimeout(resolve, 20)); // outlive the 10ms TTL
  await service.getReadings("ETH/USD");
  assert.equal(calls(), 2, "a stale cache entry should cause exactly one re-fetch, not a leak of calls");
});

test("different assets are cached independently — one doesn't satisfy the other from cache", async () => {
  const { adapter, calls } = countingAdapter("source-ok");
  const service = createOracleService([adapter], {
    cache: createInMemoryObservationCache(),
    cacheTtlMs: 30_000,
  });

  await service.getReadings("ETH/USD");
  await service.getReadings("BTC/USD");

  assert.equal(calls(), 2);
});

test("a reading built from a cached observation is still evaluated against the current time, not frozen at cache-write time", async () => {
  const cache = createInMemoryObservationCache();
  const shortLivedPolicy = { freshAfterMs: 10, maxAgeMs: 20 };
  const adapter: OracleSourceAdapter = {
    id: "source-ok",
    async fetchObservation(asset) {
      return { asset, value: 1, unit: "USD", observedAt: Date.now() };
    },
  };
  const service = createOracleService([adapter], {
    cache,
    cacheTtlMs: 10_000, // cache stays "fresh enough to serve" far longer than the policy's own window
    policy: shortLivedPolicy,
  });

  const first = await service.getReadings("ETH/USD");
  assert.equal(first[0].status, "OK");

  await new Promise((resolve) => setTimeout(resolve, 30)); // outlive the policy's maxAgeMs, not the cache TTL
  const second = await service.getReadings("ETH/USD");

  assert.equal(second[0].status, "STALE", "the cached observation is now old enough to be STALE");
  assert.equal(second[0].observation?.value, first[0].observation?.value, "same underlying observation, reused from cache");
});
