import assert from "node:assert/strict";
import test from "node:test";
import { describeCycle, describeState, finalStates, transitionDirection } from "./exposition-text.ts";

test("a cycle's text alternative states every step in order and the return to the first", () => {
  assert.equal(
    describeCycle("A feedback loop", ["Measure", "Compare with target", "Adjust"]),
    "A feedback loop: Measure, then Compare with target, then Adjust, then back to Measure, and again.",
  );
  assert.equal(describeCycle("Two-step loop", ["Rise", "Attract buyers"]), "Two-step loop: Rise, then Attract buyers, then back to Rise, and again.");
});

test("a state model's text alternative keeps every transition's direction and condition, and names final states", () => {
  // Asymmetric entry and exit: the conditions differ, and both are stated.
  assert.equal(
    describeState("Operating modes", ["Normal", "Defensive"], [
      { from: "Normal", to: "Defensive", when: "the signal rises above the entry threshold" },
      { from: "Defensive", to: "Normal", when: "the signal stays below a lower exit threshold" },
    ]),
    "Operating modes: starts in Normal. From Normal, when the signal rises above the entry threshold, to Defensive. From Defensive, when the signal stays below a lower exit threshold, back to Normal.",
  );
  const retries = [
    { from: "Waiting", to: "Attempting", when: "the delay elapses" },
    { from: "Attempting", to: "Done", when: "the action is confirmed" },
    { from: "Attempting", to: "Waiting", when: "it fails and retries remain" },
    { from: "Waiting", to: "Waiting", when: "another failure arrives" },
    { from: "Waiting", to: "Abandoned", when: "no retries remain" },
  ];
  // Transitions are said state by state in the listed order, each in the order given.
  assert.equal(
    describeState("Retries", ["Attempting", "Waiting", "Done", "Abandoned"], retries),
    "Retries: starts in Attempting. From Attempting, when the action is confirmed, to Done. From Attempting, when it fails and retries remain, to Waiting. From Waiting, when the delay elapses, back to Attempting. From Waiting, when another failure arrives, it stays in Waiting. From Waiting, when no retries remain, to Abandoned. Done and Abandoned are final.",
  );
  assert.deepEqual(finalStates(["Attempting", "Waiting", "Done", "Abandoned"], retries), ["Done", "Abandoned"]);
  assert.deepEqual(
    [transitionDirection(["A", "B"], "A", "B"), transitionDirection(["A", "B"], "B", "A"), transitionDirection(["A", "B"], "B", "B")],
    ["forward", "return", "stay"],
  );
});

test("the cycle wording is unchanged by the state model", () => {
  assert.equal(describeCycle("Loop", ["A", "B"]), "Loop: A, then B, then back to A, and again.");
});
