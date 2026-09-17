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
  assert.equal(readings[0].reason, "The source could not provide an observation.");
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

for (const failureMode of ["throw", "null"] as const) {
  test(`expired cache + ${failureMode}: original timestamps, current age, backoff and recovery`, async (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: 1_000_000 });
    let failing = false;
    let calls = 0;
    const adapter: OracleSourceAdapter = {
      id: "coingecko",
      async fetchObservation(asset) {
        calls++;
        if (failing) {
          if (failureMode === "throw") throw new Error("upstream offline");
          return null;
        }
        return { asset, value: calls, unit: "USD", observedAt: Date.now() - 170_000 };
      },
    };
    const cache = createInMemoryObservationCache();
    const service = createOracleService([adapter], { cache });
    const [first] = await service.getReadings("ETH/USD");
    assert.equal(first.delivery, "UPSTREAM");
    assert.equal(first.freshness, "FRESH");
    t.mock.timers.tick(10_000);
    const [hit] = await service.getReadings("ETH/USD");
    assert.equal(hit.delivery, "CACHE");
    assert.equal(hit.fetchedAt, first.fetchedAt);
    assert.equal(calls, 1);

    failing = true;
    t.mock.timers.tick(20_000);
    const results = await Promise.all(Array.from({ length: 5 }, () => service.getReadings("ETH/USD")));
    assert.equal(calls, 2, "failed refreshes coalesce");
    const fallback = results[0][0];
    assert.equal(fallback.delivery, "FALLBACK");
    assert.equal(fallback.freshness, "AGING");
    assert.equal(fallback.status, "OK", "age and delivery health are independent");
    assert.equal(fallback.observation?.observedAt, first.observation?.observedAt);
    assert.equal(fallback.fetchedAt, first.fetchedAt);
    assert.equal(fallback.latencyMs, 200_000);
    assert.ok(fallback.refreshError);
    assert.equal((await cache.get("coingecko:ETH/USD"))?.cachedAt, first.fetchedAt);
    await service.getReadings("ETH/USD");
    assert.equal(calls, 2, "no immediate retry storm");

    t.mock.timers.tick(110_001);
    const [old] = await service.getReadings("ETH/USD");
    assert.equal(old.status, "STALE");
    assert.equal(old.latencyMs, 310_001);
    assert.equal(old.observation?.observedAt, first.observation?.observedAt);
    assert.equal(old.retrievedAt, Date.now());
    const [btc] = await service.getReadings("BTC/USD");
    assert.equal(btc.status, "UNAVAILABLE", "ETH fallback cannot satisfy BTC");
    assert.equal(btc.observation, null);

    failing = false;
    t.mock.timers.tick(60_000);
    const [recovered] = await service.getReadings("ETH/USD");
    assert.equal(recovered.delivery, "UPSTREAM");
    assert.equal(recovered.refreshError, undefined);
    assert.equal(recovered.freshness, "FRESH");
    assert.notEqual(recovered.fetchedAt, first.fetchedAt);
  });
}

test("evaluation uses refresh completion time, including a slow failed request", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 1_000_000 });
  const cache = createInMemoryObservationCache();
  await cache.set("slow:ETH/USD", {
    observation: { asset: "ETH/USD", value: 42, unit: "USD", observedAt: 704_000 },
    cachedAt: 900_000,
  }, 3_600_000);
  const service = createOracleService([{
    id: "slow",
    async fetchObservation() {
      t.mock.timers.tick(5_000);
      throw new Error("timeout");
    },
  }], { cache });
  const [reading] = await service.getReadings("ETH/USD");
  assert.equal(reading.freshness, "STALE");
  assert.equal(reading.latencyMs, 301_000);
});

test("expired cache refresh replaces observation and retains it beyond the refresh TTL", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 1_000_000 });
  const { adapter, calls } = countingAdapter("ok");
  const cache = createInMemoryObservationCache();
  const service = createOracleService([adapter], { cache });
  const [first] = await service.getReadings("ETH/USD");
  t.mock.timers.tick(30_000);
  const [next] = await service.getReadings("ETH/USD");
  assert.equal(calls(), 2);
  assert.equal(next.delivery, "UPSTREAM");
  assert.notEqual(next.observation?.observedAt, first.observation?.observedAt);
  t.mock.timers.tick(90_000);
  assert.equal((await cache.get("ok:ETH/USD"))?.observation.observedAt, next.observation?.observedAt);
});

test("recent fallback stays FRESH by age but exposes degraded delivery; empty-cache failures back off", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 1_000_000 });
  let calls = 0;
  const cache = createInMemoryObservationCache();
  await cache.set("down:ETH/USD", {
    observation: { asset: "ETH/USD", value: 1, unit: "USD", observedAt: 950_000 },
    cachedAt: 950_000,
  }, 3_600_000);
  const service = createOracleService([{
    id: "down",
    async fetchObservation() { calls++; throw new Error("offline"); },
  }], { cache });
  const [eth] = await service.getReadings("ETH/USD");
  assert.equal(eth.freshness, "FRESH");
  assert.equal(eth.delivery, "FALLBACK");
  assert.equal(eth.refreshError, "The source could not provide an observation.");
  const [btc] = await service.getReadings("BTC/USD");
  assert.equal(btc.status, "UNAVAILABLE");
  await service.getReadings("BTC/USD");
  assert.equal(calls, 2);
  t.mock.timers.tick(30_000);
  await service.getReadings("BTC/USD");
  assert.equal(calls, 3);
  t.mock.timers.tick(30_000);
  await service.getReadings("BTC/USD");
  assert.equal(calls, 3, "second failure backs off for 60s");
});

test("fallback retention expires without being extended by failed refreshes", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 1_000_000 });
  let failing = false;
  const cache = createInMemoryObservationCache();
  const service = createOracleService([{
    id: "source",
    async fetchObservation(asset) {
      if (failing) throw new Error("offline");
      return { asset, value: 1, unit: "USD", observedAt: Date.now() };
    },
  }], { cache });
  await service.getReadings("ETH/USD");
  failing = true;
  t.mock.timers.tick(3_599_999);
  assert.equal((await service.getReadings("ETH/USD"))[0].status, "STALE");
  t.mock.timers.tick(1);
  assert.equal((await service.getReadings("ETH/USD"))[0].status, "UNAVAILABLE");
});

test("cache-write failure preserves upstream success and sources cannot share fallback", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 1_000_000 });
  const cache = createInMemoryObservationCache();
  await cache.set("one:ETH/USD", {
    observation: { asset: "ETH/USD", value: 1, unit: "USD", observedAt: 900_000 }, cachedAt: 900_000,
  }, 3_600_000);
  const service = createOracleService([
    { id: "one", async fetchObservation() { throw new Error("offline"); } },
    { id: "two", async fetchObservation() { throw new Error("offline"); } },
    countingAdapter("three").adapter,
  ], { cache: { get: cache.get, async set() { throw new Error("storage offline"); } } });
  const readings = await service.getReadings("ETH/USD");
  assert.equal(readings[0].delivery, "FALLBACK");
  assert.equal(readings[1].status, "UNAVAILABLE");
  assert.equal(readings[2].delivery, "UPSTREAM");
  assert.equal(readings[2].status, "OK");
});

test("retention expiring DURING a failed refresh cannot be delivered to coalesced callers", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 1_000_000 });
  const cache = createInMemoryObservationCache();
  let failing = false;
  let calls = 0;
  const service = createOracleService([{
    id: "race",
    async fetchObservation(asset) {
      calls++;
      if (failing) {
        t.mock.timers.tick(5_000);
        throw new Error("timeout");
      }
      return { asset, value: 1, unit: "USD", observedAt: Date.now() };
    },
  }], { cache });
  const [original] = await service.getReadings("ETH/USD");
  failing = true;
  t.mock.timers.tick(3_599_999);
  const results = await Promise.all([service.getReadings("ETH/USD"), service.getReadings("ETH/USD")]);
  for (const [reading] of results) {
    assert.equal(reading.status, "UNAVAILABLE");
    assert.equal(reading.observation, null);
    assert.equal(reading.fetchedAt, undefined);
    assert.equal(reading.retrievedAt, original.fetchedAt! + 3_604_999);
  }
  assert.equal(calls, 2);
  assert.equal(await cache.get("race:ETH/USD"), null);
});

for (const failure of [new Error("/private/path token=synthetic-secret"), "runtime synthetic-secret", new Error("")]) {
  test(`public failure boundary sanitizes ${typeof failure === "string" ? "string" : failure.message ? "exception" : "empty exception"}`, async () => {
    const cache = createInMemoryObservationCache();
    await cache.set("source:ETH/USD", {
      observation: { asset: "ETH/USD", value: 1, unit: "USD", observedAt: Date.now() - 40_000 },
      cachedAt: Date.now() - 40_000,
    }, 3_600_000);
    const service = createOracleService([{
      id: "source", async fetchObservation() { throw failure; },
    }], { cache });
    for (const asset of ["ETH/USD", "BTC/USD", "ETH/USD", "BTC/USD"]) {
      const readings = await service.getReadings(asset);
      assert.equal(readings[0].refreshError, "The source could not provide an observation.");
      assert.equal(readings[0].delivery, "FALLBACK");
      assert.doesNotMatch(JSON.stringify(readings), /private|synthetic-secret|runtime/);
      if (asset === "BTC/USD") assert.equal(readings[0].reason, readings[0].refreshError);
    }
  });
}

test("backoff saturates 30 → 60 → 60, serves fallback, isolates keys, and resets after recovery", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 1_000_000 });
  let failing = false;
  const counts = new Map<string, number>();
  const adapter = (id: string): OracleSourceAdapter => ({ id, async fetchObservation(asset) {
    const key = `${id}:${asset}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (failing) throw new Error("offline");
    return { asset, value: 1, unit: "USD", observedAt: Date.now() };
  } });
  const cache = createInMemoryObservationCache();
  const service = createOracleService([adapter("one"), adapter("two")], { cache });
  await service.getReadings("ETH/USD");
  failing = true;
  t.mock.timers.tick(30_000);
  await service.getReadings("ETH/USD");
  for (const delay of [30_000, 60_000, 60_000]) {
    const before = counts.get("one:ETH/USD")!;
    t.mock.timers.tick(delay - 1);
    const [retained] = await service.getReadings("ETH/USD");
    assert.equal(retained.delivery, "FALLBACK");
    assert.ok(retained.observation);
    assert.equal(counts.get("one:ETH/USD"), before);
    t.mock.timers.tick(1);
    await service.getReadings("ETH/USD");
    assert.equal(counts.get("one:ETH/USD"), before + 1);
    assert.equal(counts.get("two:ETH/USD"), before + 1);
  }
  await service.getReadings("BTC/USD");
  assert.equal(counts.get("one:BTC/USD"), 1);
  assert.equal(counts.get("two:BTC/USD"), 1);
  failing = false;
  t.mock.timers.tick(60_000);
  assert.equal((await service.getReadings("ETH/USD"))[0].delivery, "UPSTREAM");
  const recoveredCalls = counts.get("one:ETH/USD")!;
  await service.getReadings("ETH/USD");
  assert.equal(counts.get("one:ETH/USD"), recoveredCalls, "normal cache hit after recovery");
  failing = true;
  t.mock.timers.tick(30_000);
  await service.getReadings("ETH/USD");
  t.mock.timers.tick(29_999);
  await service.getReadings("ETH/USD");
  assert.equal(counts.get("one:ETH/USD"), recoveredCalls + 1);
  t.mock.timers.tick(1);
  await service.getReadings("ETH/USD");
  assert.equal(counts.get("one:ETH/USD"), recoveredCalls + 2, "reset to 30 seconds");
});

for (const fails of [false, true]) {
  test(`held-open concurrent distinct assets coalesce independently (${fails ? "failure" : "success"})`, async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const calls: string[] = [];
    const service = createOracleService([{
      id: "source", async fetchObservation(asset) {
        calls.push(asset);
        await gate;
        if (fails) throw new Error("offline");
        return { asset, value: 1, unit: "USD", observedAt: Date.now() };
      },
    }], { cache: createInMemoryObservationCache() });
    const requests = ["ETH/USD", "BTC/USD", "ETH/USD", "BTC/USD"].map(asset => service.getReadings(asset));
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.deepEqual(calls.sort(), ["BTC/USD", "ETH/USD"]);
    release();
    const results = await Promise.all(requests);
    assert.equal(results[0][0].asset, "ETH/USD");
    assert.equal(results[1][0].asset, "BTC/USD");
    assert.equal(results[0][0].status, fails ? "UNAVAILABLE" : "OK");
  });
}
