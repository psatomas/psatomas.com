import assert from "node:assert/strict";
import test from "node:test";
import { orchestratorModel, registryOf } from "./fixtures.ts";
import { planDomain } from "./plan.ts";
import {
  addFix,
  completeStage,
  createRunState,
  classifyCi,
  invalidate,
  nextAction,
  prMismatch,
  pendingConcepts,
  recordCheck,
  recordConcept,
  resumeRun,
  revalidate,
  RunStateError,
  STAGES,
  staleChecks,
  stopRun,
  type RunState,
} from "./run-state.ts";

const NOW = "2026-09-30T00:00:00.000Z";
const planFor = (domainId: string, options: Parameters<typeof orchestratorModel>[0] = {}) => {
  const model = orchestratorModel(options);
  return planDomain(model, domainId, { authoredContent: registryOf(model) });
};
const start = (domainId = "d2") => createRunState({ plan: planFor(domainId), branch: `feat/map-${domainId}-l1`, baseSha: "abc123", now: NOW });
/** A JSON round trip, as the CLI persists state between invocations. */
const persisted = (state: RunState): RunState => JSON.parse(JSON.stringify(state));

test("a run starts at authoring with the plan's eligible concepts pending", () => {
  const state = start();
  assert.equal(state.stage, "author");
  assert.deepEqual(state.plan.eligible, ["c", "t"]);
  assert.deepEqual(state.plan.facet, ["c"]);
  assert.deepEqual(pendingConcepts(state), ["c", "t"]);
  assert.deepEqual(nextAction(state), {
    kind: "agent",
    stage: "author",
    conceptId: "c",
    message: "author c: read `map:author -- context c`, write its canonical exposition, then `map:author -- record c`",
  });
});

test("a run refuses to start on a stop or with nothing to author", () => {
  assert.throws(() => createRunState({ plan: planFor("d2", { ambiguous: true }), branch: "b", baseSha: "s", now: NOW }), /unresolved stops: m/);
  assert.throws(() => createRunState({ plan: planFor("d3"), branch: "b", baseSha: "s", now: NOW }), /no eligible L1 topics/);
});

test("recording concepts is idempotent and the last one moves the run to the audit", () => {
  let state = recordConcept(start(), "c", NOW);
  assert.equal(recordConcept(state, "c", NOW), state);
  assert.equal(state.stage, "author");
  assert.equal(nextAction(state).kind === "agent" && nextAction(state).stage, "author");
  state = recordConcept(persisted(state), "t", NOW);
  assert.equal(state.stage, "audit");
  assert.ok(state.completed.author);
  assert.equal(nextAction(state).kind, "agent");
  assert.throws(() => recordConcept(state, "single", NOW), /not an eligible concept of d2/);
});

test("stages advance in order, completing a stage twice is a no-op, and skipping is refused", () => {
  let state = recordConcept(recordConcept(start(), "c", NOW), "t", NOW);
  assert.throws(() => completeStage(state, "gates", NOW), /the run is at audit/);
  state = completeStage(state, "audit", NOW, "checked");
  assert.equal(completeStage(state, "audit", NOW), state);
  assert.equal(state.stage, "gates");
  assert.deepEqual(nextAction(state), { kind: "tool", stage: "gates", message: "run `map:author -- run` to perform gates" });
  for (const stage of STAGES.slice(STAGES.indexOf("gates"), -1)) state = completeStage(persisted(state), stage, NOW);
  assert.equal(state.stage, "done");
  assert.deepEqual(nextAction(state), { kind: "done", stage: "done" });
});

test("authoring cannot be completed with concepts pending", () => {
  assert.throws(() => completeStage(start(), "author", NOW), /concepts still to author: c, t/);
});

test("a stopped run keeps its first reason, refuses transitions and resumes where it stopped", () => {
  const running = recordConcept(start(), "c", NOW);
  const stopped = stopRun(running, { subject: "t", evidence: "layers differ", why: "not facets", decision: "split t?" }, NOW);
  const action = nextAction(persisted(stopped));
  assert.equal(action.kind, "stop");
  assert.equal(action.kind === "stop" && action.stop.stage, "author");
  assert.equal(stopRun(stopped, { subject: "later", evidence: "e", why: "w", decision: "d" }, NOW).stop?.subject, "t");
  assert.throws(() => recordConcept(stopped, "t", NOW), RunStateError);
  assert.throws(() => addFix(stopped, { kind: "test", message: "test(map): x", files: ["a.test.ts"], reason: "r" }), /stopped at author/);
  assert.throws(() => resumeRun(stopped, " ", NOW), /needs the decision/);
  const resumed = resumeRun(persisted(stopped), "t's layers are facets after all", NOW);
  assert.equal(resumed.stop, undefined);
  assert.deepEqual(resumed.resolvedStops?.map((entry) => [entry.subject, entry.stage, entry.resolution]), [["t", "author", "t's layers are facets after all"]]);
  assert.deepEqual(nextAction(resumed), nextAction(running));
  assert.equal(resumeRun(resumed, "again", NOW), resumed);
});

test("a tree changed after validation is revalidated from the gates, never across commits", () => {
  let state = completeStage(recordConcept(recordConcept(start(), "c", NOW), "t", NOW), "audit", NOW);
  state = recordCheck(state, "test", true, "ok", NOW, "tree-1");
  state = recordCheck(state, "note", true, "untied", NOW);
  state = completeStage(completeStage(completeStage(state, "gates", NOW), "browser", NOW), "render", NOW);
  assert.deepEqual(staleChecks(state, "tree-1"), []);
  assert.deepEqual(staleChecks(state, "tree-2"), ["test"]);
  const rewound = revalidate({ ...state, validatedFiles: { f: "h" } });
  assert.equal(rewound.stage, "gates");
  assert.deepEqual(Object.keys(rewound.completed).sort(), ["audit", "author"]);
  assert.deepEqual(Object.keys(rewound.checks), ["note"]);
  assert.equal(rewound.validatedFiles, undefined);
  assert.throws(() => revalidate({ ...state, commits: [{ sha: "x", message: "m", files: [] }] }), /has commits/);
  assert.throws(() => revalidate(start()), /cannot revalidate at author/);
});

test("general fixes are declared once, only before committing and only within the fix policy", () => {
  const fix = { kind: "test" as const, message: "test(map): derive expectations from the registry", files: ["src/lib/map/map.test.ts"], reason: "brittle" };
  const state = addFix(addFix(start(), fix), fix);
  assert.equal(state.fixes.length, 1);
  assert.throws(() => addFix({ ...state, commits: [{ sha: "x", message: "m", files: [] }] }, { ...fix, message: "test(map): other" }), /before committing/);
  assert.throws(() => addFix(state, { kind: "fix", message: "fix(map): tune the renderer", files: ["src/components/map/concept-exposition.tsx"], reason: "r" }), /not a general fix/);
  assert.throws(() => addFix(state, { kind: "test", message: "test(map): also data", files: ["src/lib/map/data.ts"], reason: "r" }), /content file/);
  assert.throws(() => addFix(state, { ...fix, message: "test(map): same file again" }), /belongs to two fixes/);
});

test("checks record their latest result", () => {
  const state = recordCheck(recordCheck(start(), "test", false, "1 failing", NOW), "test", true, "412 passing", NOW);
  assert.deepEqual(state.checks.test, { ok: true, at: NOW, detail: "412 passing" });
});

/** A run at `stage`, all concepts recorded, audited over content "content-1", gates run on tree "tree-1" and build "build-1". */
function validatedRun(stage: "browser" | "render" | "diff" | "commit") {
  let state = completeStage(recordConcept(recordConcept(start(), "c", NOW), "t", NOW), "audit", NOW, "No corrections.");
  state = { ...state, auditContent: "content-1", auditNotes: ["No corrections."] };
  for (const name of ["generate", "test", "lint", "build"]) state = recordCheck(state, name, true, "ok", NOW, "tree-1");
  state = { ...completeStage(state, "gates", NOW), buildId: "build-1" };
  for (const next of ["browser", "render", "diff"] as const) {
    if (state.stage === stage) break;
    state = recordCheck(state, next, true, "ok", NOW, "tree-1");
    state = completeStage(state, next, NOW);
  }
  return stage === "commit" ? { ...state, validatedFiles: { "src/lib/map/data.ts": "h" } } : state;
}
const SAME = { tree: "tree-1", content: "content-1", buildId: "build-1" };

test("an unchanged run keeps every result", () => {
  for (const stage of ["browser", "render", "diff", "commit"] as const) {
    const state = validatedRun(stage);
    assert.equal(invalidate(state, SAME).state, state, stage);
  }
});

test("a content correction after the audit reopens the audit and drops every later result", () => {
  const { state, reason } = invalidate(validatedRun("render"), { ...SAME, content: "content-2", tree: "tree-2" });
  assert.match(reason!, /content changed after the audit/);
  assert.equal(state.stage, "audit");
  assert.deepEqual(Object.keys(state.completed), ["author"]);
  assert.deepEqual(state.checks, {});
  assert.equal(state.buildId, undefined);
  assert.equal(state.auditContent, undefined);
  assert.deepEqual(state.auditNotes, ["No corrections."]);
  assert.equal(nextAction(state).kind, "agent");
});

test("a tree change that leaves the content alone (a test fix, say) revalidates from the gates", () => {
  for (const stage of ["browser", "render", "diff", "commit"] as const) {
    const { state, reason } = invalidate(validatedRun(stage), { ...SAME, tree: "tree-2" });
    assert.match(reason!, /the tree changed since generate, test, lint, build/, stage);
    assert.equal(state.stage, "gates");
    assert.deepEqual(Object.keys(state.completed).sort(), ["audit", "author"]);
    assert.deepEqual(state.checks, {});
    assert.equal(state.validatedFiles, undefined);
    assert.equal(state.auditContent, "content-1");
  }
});

test("a different production build sends browser and render checks back to the gates, not later stages", () => {
  for (const stage of ["browser", "render"] as const) {
    const { state, reason } = invalidate(validatedRun(stage), { ...SAME, buildId: "build-2" });
    assert.match(reason!, /production build/);
    assert.equal(state.stage, "gates");
  }
  const atDiff = validatedRun("diff");
  assert.equal(invalidate(atDiff, { ...SAME, buildId: "build-2" }).state, atDiff);
});

test("nothing is rewound once commits exist, or while the run is stopped", () => {
  const committed = { ...validatedRun("commit"), commits: [{ sha: "x", message: "m", files: [] }] };
  assert.equal(invalidate(committed, { tree: "t", content: "c" }).state, committed);
  const stopped = stopRun(validatedRun("render"), { subject: "s", evidence: "e", why: "w", decision: "d" }, NOW);
  assert.equal(invalidate(stopped, { tree: "t", content: "c" }).state, stopped);
});

test("a pull request counts as the run's only when open, against main, at the pushed commit", () => {
  const pr = { number: 7, url: "u", state: "OPEN", headRefOid: "abc1234def", baseRefName: "main" };
  assert.equal(prMismatch("abc1234def", pr), undefined);
  assert.equal(prMismatch("abc1234def", { ...pr, baseRefName: "develop" }), "#7 targets develop, not main");
  assert.equal(prMismatch("fff0000aaa", pr), "#7 is at abc1234, the run pushed fff0000");
  assert.equal(prMismatch(undefined, pr), "#7 is at abc1234, the run pushed nothing");
  assert.equal(prMismatch("abc1234def", { ...pr, state: "MERGED" }), "#7 is MERGED");
  assert.equal(prMismatch("abc1234def", { ...pr, state: "CLOSED" }), "#7 is CLOSED");
});

test("CI passes only on evidence: at least one check, every one passed or skipped", () => {
  const check = (name: string, bucket: string, state = bucket.toUpperCase()) => ({ name, bucket, state });
  assert.deepEqual(classifyCi([check("build", "pass", "SUCCESS")]), { status: "passing", detail: "build" });
  assert.deepEqual(classifyCi([check("build", "pass"), check("docs", "skipping")]), { status: "passing", detail: "build, docs" });
  assert.deepEqual(classifyCi([]), { status: "pending", detail: "no checks reported yet" });
  assert.deepEqual(classifyCi([check("build", "pending", "IN_PROGRESS")]), { status: "pending", detail: "build IN_PROGRESS" });
  assert.equal(classifyCi([check("build", "pass"), check("e2e", "fail", "FAILURE")]).status, "failing");
  assert.deepEqual(classifyCi([{ ...check("build", "fail", "FAILURE"), link: "https://ci/1" }]), { status: "failing", detail: "build FAILURE https://ci/1" });
  assert.equal(classifyCi([check("build", "cancel", "CANCELLED")]).status, "failing");
  // An unknown bucket is not evidence of success.
  assert.equal(classifyCi([check("build", "neutral")]).status, "pending");
});
