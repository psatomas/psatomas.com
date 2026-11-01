import assert from "node:assert/strict";
import test from "node:test";
import { orchestratorModel, registryOf } from "./fixtures.ts";
import { planDomain } from "./plan.ts";
import { checkScope, completeStage, createRunState, gateOrder, invalidate, recordCheck, recordConcept, reusableCheck, revalidate, staleChecks, type RunState } from "./run-state.ts";

const NOW = "2026-11-01T00:00:00.000Z";
const start = () => {
  const model = orchestratorModel();
  return createRunState({ plan: planDomain(model, "d2", { authoredContent: registryOf(model) }), branch: "feat/map-d2-l1", baseSha: "abc123", now: NOW });
};
/** Fingerprints: the whole tree, the runtime tree (without group files), and the production build. */
const TREE = "tree-1";
const RUNTIME = "runtime-1";
const BUILD = "build-1";

/** A run validated up to `stage`, its checks bound as runStage binds them. */
function validatedRun(stage: "browser" | "render" | "diff" | "commit"): RunState {
  let state = completeStage(recordConcept(recordConcept(start(), "c", NOW), "t", NOW), "audit", NOW, "No corrections.");
  state = { ...state, auditContent: "content-1" };
  const bind = (current: RunState, name: string) => recordCheck(current, name, true, `${name} ok`, NOW, TREE, checkScope(name, RUNTIME, BUILD));
  for (const name of ["l2-check", "generate", "test", "lint", "build"]) state = bind(state, name);
  state = { ...completeStage(state, "gates", NOW), buildId: BUILD };
  const later: Record<string, string[]> = { browser: ["browser"], render: ["render", "expansion"], diff: ["worker-budget", "diff"] };
  for (const next of ["browser", "render", "diff"] as const) {
    if (state.stage === stage) break;
    for (const name of later[next]) state = bind(state, name);
    state = completeStage(state, next, NOW);
  }
  return state;
}

test("only checks of what the site is built from are bound to the runtime tree, and only those that used a build to the build", () => {
  assert.deepEqual(checkScope("build", "r", "b"), { runtime: "r", build: "b" });
  assert.deepEqual(checkScope("browser", "r", "b"), { runtime: "r", build: "b" });
  assert.deepEqual(checkScope("worker-budget", "r", "b"), { runtime: "r" });
  for (const name of ["l2-check", "generate", "test", "lint", "diff"]) assert.deepEqual(checkScope(name, "r", "b"), {}, name);
  assert.deepEqual(recordCheck(start(), "build", true, "ok", NOW, TREE, checkScope("build", RUNTIME, BUILD)).checks.build, { ok: true, at: NOW, detail: "ok", tree: TREE, runtime: RUNTIME, build: BUILD });
});

test("the L2 check runs before the unit tests, lint and build", () => {
  assert.deepEqual(gateOrder(["generate", "test", "lint", "build"], "l2-check"), ["l2-check", "generate", "test", "lint", "build"]);
  assert.deepEqual(gateOrder(["generate", "test", "lint", "build"]), ["generate", "test", "lint", "build"]);
});

test("a change to group files alone (an audit re-recorded) reruns the cheap checks and keeps the build, browser, render and Worker results", () => {
  for (const stage of ["browser", "render", "diff", "commit"] as const) {
    const run = validatedRun(stage);
    // The whole tree moved (a group file); the runtime tree did not.
    const { state, reason } = invalidate(run, { tree: "tree-2", runtime: RUNTIME, content: "content-1", buildId: BUILD });
    assert.equal(state.stage, "gates", stage);
    assert.match(reason!, /revalidating from the gates/);
    for (const name of ["l2-check", "generate", "test", "lint", "diff"]) assert.equal(state.checks[name], undefined, `${stage}: ${name} is run again`);
    for (const name of Object.keys(run.checks).filter((name) => ["build", "browser", "render", "expansion", "worker-budget"].includes(name))) {
      assert.ok(reusableCheck(state, name, { runtime: RUNTIME, buildId: BUILD }), `${stage}: ${name} is reused`);
    }
    assert.equal(state.auditContent, "content-1");
  }
});

test("a kept result is reused only while its runtime tree and its build hold, and never if it failed", () => {
  const { state } = invalidate(validatedRun("commit"), { tree: "tree-2", runtime: RUNTIME, content: "content-1", buildId: BUILD });
  // Another build on disk (the Worker check's OpenNext build, a dev server): the build and every check that used it run again.
  for (const name of ["build", "browser", "render", "expansion"]) assert.equal(reusableCheck(state, name, { runtime: RUNTIME, buildId: "build-2" }), false, name);
  assert.equal(reusableCheck(state, "worker-budget", { runtime: RUNTIME, buildId: "build-2" }), true);
  // Anything the site is built from changed: nothing is reused.
  for (const name of ["build", "browser", "worker-budget"]) assert.equal(reusableCheck(state, name, { runtime: "runtime-2", buildId: BUILD }), false, name);
  const failed = recordCheck(state, "browser", false, "FAILED", NOW, TREE, checkScope("browser", RUNTIME, BUILD));
  assert.equal(reusableCheck(failed, "browser", { runtime: RUNTIME, buildId: BUILD }), false);
  // A check recorded before runtime binding (no runtime) is never reused.
  assert.equal(reusableCheck(recordCheck(state, "build", true, "ok", NOW, TREE), "build", { runtime: RUNTIME, buildId: BUILD }), false);
});

test("a runtime change drops the runtime-bound results too: everything is validated again", () => {
  const { state, reason } = invalidate(validatedRun("commit"), { tree: "tree-2", runtime: "runtime-2", content: "content-1", buildId: BUILD });
  assert.equal(state.stage, "gates");
  assert.match(reason!, /build/);
  assert.deepEqual(state.checks, {});
  // Without a runtime fingerprint (an older caller), every tree-bound check is judged on the whole tree, as before.
  assert.deepEqual(staleChecks(validatedRun("commit"), "tree-2").sort(), ["browser", "build", "diff", "expansion", "generate", "l2-check", "lint", "render", "test", "worker-budget"]);
  assert.deepEqual(staleChecks(validatedRun("commit"), "tree-2", RUNTIME).sort(), ["diff", "generate", "l2-check", "lint", "test"]);
});

test("revalidating keeps runtime-bound results for re-judgment, and drops the ones named", () => {
  const run = validatedRun("commit");
  assert.deepEqual(Object.keys(revalidate(run).checks).sort(), ["browser", "build", "expansion", "render", "worker-budget"]);
  assert.deepEqual(Object.keys(revalidate(run, ["browser"]).checks).sort(), ["build", "expansion", "render", "worker-budget"]);
});

test("content changed after the audit still reopens the audit and drops every result, runtime-bound ones included", () => {
  const { state, reason } = invalidate(validatedRun("render"), { tree: "tree-2", runtime: "runtime-2", content: "content-2", buildId: BUILD });
  assert.match(reason!, /content changed after the audit/);
  assert.equal(state.stage, "audit");
  assert.deepEqual(state.checks, {});
});

test("an audit completed under the earlier content fingerprint still matches it", () => {
  const run = validatedRun("render");
  // The tooling now fingerprints group files without their audits; a run audited before records the older fingerprint.
  assert.equal(invalidate(run, { tree: TREE, runtime: RUNTIME, content: "content-new", legacyContent: "content-1", buildId: BUILD }).state, run);
  assert.equal(invalidate(run, { tree: TREE, runtime: RUNTIME, content: "content-new", legacyContent: "content-other", buildId: BUILD }).state.stage, "audit");
});
