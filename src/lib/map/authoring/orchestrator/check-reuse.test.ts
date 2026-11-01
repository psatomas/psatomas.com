import assert from "node:assert/strict";
import test from "node:test";
import { gateOrder } from "./run-state.ts";

test("the L2 check runs before the unit tests, lint and build", () => {
  assert.deepEqual(gateOrder(["generate", "test", "lint", "build"], "l2-check"), ["l2-check", "generate", "test", "lint", "build"]);
  assert.deepEqual(gateOrder(["generate", "test", "lint", "build"]), ["generate", "test", "lint", "build"]);
});
