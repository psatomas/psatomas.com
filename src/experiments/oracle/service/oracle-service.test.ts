import { test } from "node:test";
import assert from "node:assert/strict";
import { createOracleService } from "./oracle-service.ts";
import { createDevOracleAdapter } from "./dev-adapter.ts";
import type { OracleSourceAdapter } from "./oracle-source.ts";

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
