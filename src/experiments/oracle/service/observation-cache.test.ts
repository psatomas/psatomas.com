import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createInMemoryObservationCache,
  createKvObservationCache,
  createResilientObservationCache,
  type CachedObservation,
} from "./observation-cache.ts";

const SAMPLE: CachedObservation = {
  observation: { asset: "ETH/USD", value: 3000, unit: "USD", observedAt: 1735000000000 },
  cachedAt: 1735000000500,
};

/**
 * A minimal stand-in for the slice of KVNamespace this module actually
 * uses (get with the "json" type, and put with an expirationTtl option).
 * Good enough to prove createKvObservationCache/createResilientObservationCache
 * delegate to whatever KV-like object their resolver currently returns —
 * not a claim that this reproduces Cloudflare KV's real semantics
 * (eventual consistency, the 60s minimum TTL enforcement server-side,
 * etc.), which only the real binding under Miniflare/production can.
 */
function createFakeKv() {
  const store = new Map<string, unknown>();
  return {
    async get<T>(key: string) {
      return (store.has(key) ? store.get(key) : null) as T | null;
    },
    async put(key: string, value: string) {
      store.set(key, JSON.parse(value));
    },
  } as unknown as KVNamespace;
}

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

// --- Regression coverage for the Miniflare poisoned-stub fix ---------------
//
// These tests can't reproduce Miniflare's actual stub-poisoning mechanism —
// that requires the real Miniflare runtime, which is what the manual
// hot-reload validation in the implementation report covers. What they can
// and do verify is the property the fix actually depends on:
// createKvObservationCache/createResilientObservationCache never memoize the
// binding they're given — they call `resolveKv` again on every single
// get/set — so a resolver that starts returning a different (or no) binding
// on a later call is honored immediately, not shadowed by one captured on
// an earlier call. That's the exact bug class a module-scope cache holding
// a resolved binding would reintroduce.

test("createKvObservationCache calls resolveKv fresh on every get and set, not once", async () => {
  const kv = createFakeKv();
  let calls = 0;
  const cache = createKvObservationCache(async () => {
    calls++;
    return kv;
  });

  await cache.set("k", SAMPLE, 30_000);
  await cache.get("k");
  await cache.get("k");

  assert.equal(calls, 3);
});

test("createKvObservationCache never reuses a binding from an earlier call", async () => {
  const first = createFakeKv();
  const second = createFakeKv();
  let resolved = first;
  const cache = createKvObservationCache(async () => resolved);

  await cache.set("k", SAMPLE, 30_000);
  resolved = second; // simulates the binding changing between calls
  const fromSecond = await cache.get("k");

  // The write landed on `first`; once the resolver starts returning
  // `second`, reads must reflect `second` — a miss here — not silently
  // keep serving whatever was resolved at construction time.
  assert.equal(fromSecond, null);
  assert.deepEqual(await first.get("k"), SAMPLE);
});

test("createKvObservationCache treats an unreachable binding as a miss/no-op, not an error", async () => {
  const cache = createKvObservationCache(async () => undefined);

  await assert.doesNotReject(cache.set("k", SAMPLE, 30_000));
  assert.equal(await cache.get("k"), null);
});

test("createResilientObservationCache delegates to KV when the binding is reachable", async () => {
  const kv = createFakeKv();
  const cache = createResilientObservationCache(async () => kv);

  await cache.set("k", SAMPLE, 30_000);

  assert.deepEqual(await kv.get("k"), SAMPLE);
  assert.deepEqual(await cache.get("k"), SAMPLE);
});

test("createResilientObservationCache falls back to in-memory when no binding is reachable", async () => {
  const cache = createResilientObservationCache(async () => undefined);

  await cache.set("k", SAMPLE, 30_000);

  assert.deepEqual(await cache.get("k"), SAMPLE);
});

test("createResilientObservationCache re-evaluates reachability on every call rather than deciding once", async () => {
  let kv: KVNamespace | undefined = undefined;
  const cache = createResilientObservationCache(async () => kv);

  // Binding unreachable at first: falls back to in-memory.
  await cache.set("k", SAMPLE, 30_000);
  assert.deepEqual(await cache.get("k"), SAMPLE);

  // Binding becomes reachable later (e.g. context resolves on a later
  // call): a fresh write now goes to KV, and is visible through it —
  // proving the earlier "unreachable" outcome wasn't cached as a
  // permanent decision.
  kv = createFakeKv();
  await cache.set("k2", SAMPLE, 30_000);
  assert.deepEqual(await kv.get("k2"), SAMPLE);
});
