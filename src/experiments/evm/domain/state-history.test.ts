import { test } from "node:test";
import assert from "node:assert/strict";
import { executeTransition } from "./state-transition.ts";
import {
  GENESIS_ENTRY,
  INITIAL_STATE,
  MAX_HISTORY_ENTRIES,
  appendHistory,
  historyEntryFromResult,
} from "./state-history.ts";

test("initial canonical state is 10", () => {
  assert.equal(INITIAL_STATE, 10);
  assert.equal(GENESIS_ENTRY.value, 10);
  assert.equal(GENESIS_ENTRY.status, "GENESIS");
});

test("a committed transaction's history entry carries the post-state as its value", () => {
  const result = executeTransition(10, "INCREMENT");
  const entry = historyEntryFromResult(1, result);
  assert.equal(entry.id, "TX 01");
  assert.equal(entry.value, 11);
  assert.equal(entry.status, "COMMITTED");
  assert.equal(entry.attemptedWrite, undefined);
});

test("a reverted transaction's history entry carries the unchanged pre-state as its value, never the attempted write", () => {
  const result = executeTransition(12, "REVERT");
  const entry = historyEntryFromResult(3, result);
  assert.equal(entry.id, "TX 03");
  assert.equal(entry.value, 12); // canonical state, unchanged
  assert.equal(entry.attemptedWrite, 13); // observable, but not canonical
  assert.equal(entry.status, "REVERTED");
  assert.notEqual(entry.value, entry.attemptedWrite);
});

test("transaction numbering stays coherent across a mixed commit/revert sequence", () => {
  let state = INITIAL_STATE;
  let history = [GENESIS_ENTRY];

  const r1 = executeTransition(state, "INCREMENT"); // 10 -> 11
  history = appendHistory(history, historyEntryFromResult(1, r1));
  state = r1.postState;

  const r2 = executeTransition(state, "INCREMENT"); // 11 -> 12
  history = appendHistory(history, historyEntryFromResult(2, r2));
  state = r2.postState;

  const r3 = executeTransition(state, "REVERT"); // 12 -> attempts 13, stays 12
  history = appendHistory(history, historyEntryFromResult(3, r3));
  state = r3.status === "COMMITTED" ? r3.postState : state;

  assert.deepEqual(
    history.map((h) => h.id),
    ["GENESIS", "TX 01", "TX 02", "TX 03"],
  );
  assert.equal(state, 12); // canonical state never advanced past the revert
  assert.equal(history.at(-1)?.value, 12);
  assert.equal(history.at(-1)?.attemptedWrite, 13);
  assert.equal(history.at(-1)?.status, "REVERTED");
});

test("history bound is enforced: genesis stays pinned, oldest transaction drops first", () => {
  let history = [GENESIS_ENTRY];
  for (let i = 1; i <= MAX_HISTORY_ENTRIES + 5; i++) {
    history = appendHistory(history, historyEntryFromResult(i, executeTransition(10, "INCREMENT")));
  }

  assert.equal(history.length, MAX_HISTORY_ENTRIES);
  assert.equal(history[0].id, "GENESIS");
  // the most recent transaction (numbered past the bound) is still present
  assert.equal(history.at(-1)?.id, `TX ${String(MAX_HISTORY_ENTRIES + 5).padStart(2, "0")}`);
  // an early transaction was trimmed
  assert.ok(!history.some((h) => h.id === "TX 01"));
});

test("reset restores genesis-only history", () => {
  let history = [GENESIS_ENTRY];
  history = appendHistory(history, historyEntryFromResult(1, executeTransition(10, "INCREMENT")));
  assert.equal(history.length, 2);

  history = [GENESIS_ENTRY];
  assert.deepEqual(history, [GENESIS_ENTRY]);
});
