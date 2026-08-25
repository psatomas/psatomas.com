import { test } from "node:test";
import assert from "node:assert/strict";
import { createInMemoryObservationCache } from "./observation-cache.ts";

test("a missing key returns null", async () => {
  const cache = createInMemoryObservationCache();
  assert.equal(await cache.get("coingecko:ETH/USD"), null);
});

test("set then get roundtrips the same value", async () => {
  const cache = createInMemoryObservationCache();
  const value = {
    observation: { asset: "ETH/USD", value: 3000, unit: "USD", observedAt: 1735000000000 },
    cachedAt: 1735000000500,
  };

  await cache.set("coingecko:ETH/USD", value, 30_000);

  assert.deepEqual(await cache.get("coingecko:ETH/USD"), value);
});

test("different keys don't collide", async () => {
  const cache = createInMemoryObservationCache();
  const eth = { observation: { asset: "ETH/USD", value: 3000, unit: "USD", observedAt: 1 }, cachedAt: 1 };
  const btc = { observation: { asset: "BTC/USD", value: 78000, unit: "USD", observedAt: 2 }, cachedAt: 2 };

  await cache.set("coingecko:ETH/USD", eth, 30_000);
  await cache.set("coingecko:BTC/USD", btc, 30_000);

  assert.deepEqual(await cache.get("coingecko:ETH/USD"), eth);
  assert.deepEqual(await cache.get("coingecko:BTC/USD"), btc);
});
