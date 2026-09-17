import { test } from "node:test";
import assert from "node:assert/strict";
import { executeTransition } from "./state-transition.ts";

test("increment commits post = pre + 1", () => {
  const result = executeTransition(10, "INCREMENT");
  assert.equal(result.preState, 10);
  assert.equal(result.attemptedWrite, 11);
  assert.equal(result.postState, 11);
  assert.equal(result.status, "COMMITTED");
});

test("decrement commits post = pre - 1", () => {
  const result = executeTransition(11, "DECREMENT");
  assert.equal(result.preState, 11);
  assert.equal(result.attemptedWrite, 10);
  assert.equal(result.postState, 10);
  assert.equal(result.status, "COMMITTED");
});

test("revert attempts pre + 1 but leaves post-state equal to pre-state", () => {
  const result = executeTransition(12, "REVERT");
  assert.equal(result.preState, 12);
  assert.equal(result.attemptedWrite, 13);
  assert.equal(result.postState, 12);
  assert.equal(result.status, "REVERTED");
  assert.notEqual(result.postState, result.attemptedWrite);
});

test("increment trace uses ADD, never SUB", () => {
  const result = executeTransition(10, "INCREMENT");
  const opStep = result.trace.find((s) => s.label === "ADD" || s.label === "SUB");
  assert.equal(opStep?.label, "ADD");
  assert.equal(opStep?.value, "+1");
});

test("decrement trace uses SUB, never ADD", () => {
  const result = executeTransition(10, "DECREMENT");
  const opStep = result.trace.find((s) => s.label === "ADD" || s.label === "SUB");
  assert.equal(opStep?.label, "SUB");
  assert.equal(opStep?.value, "-1");
});

test("revert trace ends in REVERT / DISCARDED, not COMMIT", () => {
  const result = executeTransition(12, "REVERT");
  const lastStep = result.trace.at(-1);
  assert.equal(lastStep?.label, "REVERT");
  assert.equal(lastStep?.value, "DISCARDED");
});

test("committed trace ends in COMMIT with the post-state value", () => {
  const result = executeTransition(10, "INCREMENT");
  const lastStep = result.trace.at(-1);
  assert.equal(lastStep?.label, "COMMIT");
  assert.equal(lastStep?.value, "11");
});

test("modeled gas usage is deterministic and identical across operations", () => {
  const inc = executeTransition(10, "INCREMENT");
  const dec = executeTransition(10, "DECREMENT");
  const rev = executeTransition(10, "REVERT");
  assert.equal(inc.modeledGasUsed, dec.modeledGasUsed);
  assert.equal(dec.modeledGasUsed, rev.modeledGasUsed);
  assert.equal(inc.modeledGasUsed, executeTransition(10, "INCREMENT").modeledGasUsed);
});
