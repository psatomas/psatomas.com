import assert from "node:assert/strict";
import test from "node:test";
import { planFixVerification } from "./fix-verification.ts";

const SECTIONS: Record<string, string[]> = { "e2e/map/interaction.mts": ["structure", "interaction"], "e2e/map/coverage.mts": ["labels"] };
const plan = (...files: string[]) => planFixVerification(files, (file) => SECTIONS[file] ?? []);

test("tooling and unit-test fixes are type-checked and unit-tested, with no browser work", () => {
  assert.deepEqual(plan("src/lib/map/map.test.ts", "scripts/map-author.ts"), { typecheck: true, unit: true, build: false, suite: [], render: false, unverifiable: [] });
});

test("a browser-section fix runs exactly its own sections against a build of the base tree", () => {
  assert.deepEqual(plan("e2e/map/interaction.mts"), { typecheck: true, unit: true, build: true, suite: ["structure", "interaction"], render: false, unverifiable: [] });
  assert.deepEqual(plan("e2e/map/interaction.mts", "e2e/map/coverage.mts").suite, ["structure", "interaction", "labels"]);
});

test("a render-check fix runs the render check; shared harness fixes run the whole suite and the render check", () => {
  assert.deepEqual(plan("e2e/map/render-check.mts"), { typecheck: true, unit: true, build: true, suite: [], render: true, unverifiable: [] });
  for (const file of ["e2e/map/harness.mts", "e2e/map/run.mts"]) {
    const { suite, render, build } = plan(file);
    assert.deepEqual([suite, render, build], ["all", true, true], file);
  }
});

test("a browser file no focused check exercises is unverifiable, never passed on the unit suite", () => {
  assert.deepEqual(plan("e2e/map/helpers.mts").unverifiable, ["e2e/map/helpers.mts"]);
  assert.deepEqual(plan("e2e/other/thing.mts").unverifiable, ["e2e/other/thing.mts"]);
});
