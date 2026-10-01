import assert from "node:assert/strict";
import test from "node:test";
import { describeCycle } from "./exposition-text.ts";

test("a cycle's text alternative states every step in order and the return to the first", () => {
  assert.equal(
    describeCycle("A feedback loop", ["Measure", "Compare with target", "Adjust"]),
    "A feedback loop: Measure, then Compare with target, then Adjust, then back to Measure, and again.",
  );
  assert.equal(describeCycle("Two-step loop", ["Rise", "Attract buyers"]), "Two-step loop: Rise, then Attract buyers, then back to Rise, and again.");
});
