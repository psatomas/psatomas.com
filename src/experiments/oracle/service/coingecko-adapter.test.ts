import { test } from "node:test";
import assert from "node:assert/strict";
import { createCoinGeckoAdapter } from "./coingecko-adapter.ts";

/**
 * These tests mock global fetch — they verify this adapter's own
 * mapping/error-handling logic deterministically, without depending on
 * CoinGecko's real network availability during CI/local test runs.
 * The actual live integration was verified separately, once, by hand,
 * against the real API (see Phase 2 validation notes).
 */
async function withMockedFetch<T>(impl: typeof fetch, run: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  try {
    return await run();
  } finally {
    globalThis.fetch = original;
  }
}

test("maps a valid CoinGecko response into an OracleObservation", async () => {
  await withMockedFetch(
    (async () =>
      new Response(
        JSON.stringify({ ethereum: { usd: 3421.2, last_updated_at: 1735000000 } }),
        { status: 200 },
      )) as typeof fetch,
    async () => {
      const observation = await createCoinGeckoAdapter().fetchObservation("ETH/USD");
      assert.ok(observation);
      assert.equal(observation.value, 3421.2);
      assert.equal(observation.unit, "USD");
      assert.equal(observation.observedAt, 1735000000 * 1000);
    },
  );
});

test("an asset outside this adapter's map returns null without a network call", async () => {
  let called = false;
  await withMockedFetch(
    (async () => {
      called = true;
      return new Response("{}", { status: 200 });
    }) as typeof fetch,
    async () => {
      const observation = await createCoinGeckoAdapter().fetchObservation("XRP/USD");
      assert.equal(observation, null);
      assert.equal(called, false);
    },
  );
});

test("HTTP 429 throws a rate-limit-specific error", async () => {
  await withMockedFetch(
    (async () => new Response("{}", { status: 429 })) as typeof fetch,
    async () => {
      await assert.rejects(
        () => createCoinGeckoAdapter().fetchObservation("ETH/USD"),
        /rate limit/i,
      );
    },
  );
});

test("a non-OK, non-429 status throws a descriptive error", async () => {
  await withMockedFetch(
    (async () => new Response("{}", { status: 503 })) as typeof fetch,
    async () => {
      await assert.rejects(
        () => createCoinGeckoAdapter().fetchObservation("ETH/USD"),
        /503/,
      );
    },
  );
});

test("a response missing the expected fields throws a malformed-response error", async () => {
  await withMockedFetch(
    (async () => new Response(JSON.stringify({ ethereum: {} }), { status: 200 })) as typeof fetch,
    async () => {
      await assert.rejects(
        () => createCoinGeckoAdapter().fetchObservation("ETH/USD"),
        /malformed/i,
      );
    },
  );
});

test("a non-JSON body throws rather than silently producing fake data", async () => {
  await withMockedFetch(
    (async () => new Response("not json", { status: 200 })) as typeof fetch,
    async () => {
      await assert.rejects(() => createCoinGeckoAdapter().fetchObservation("ETH/USD"));
    },
  );
});
