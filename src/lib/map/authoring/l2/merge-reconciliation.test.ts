import assert from "node:assert/strict";
import test from "node:test";
import type { MapConceptContent } from "../../types.ts";
import { completeStage, createL2RepairRunState, createL2RunState, humanMerge, partialStartProblems, recordHumanMerge, reopenL2, reopenPrProblem, RunStateError, type ObservedPr, type RunState } from "../orchestrator/run-state.ts";
import { finishedConcepts, l2Branch, selectGroups, type L2Slice } from "./campaign.ts";
import { filledG1, model } from "./fixtures.ts";
import { repairBaseline } from "./repair.ts";
import type { L2GroupFile } from "./territory.ts";

// The lifecycle of a run without a campaign merge authorization: validated PR (done at CI) → reopened for review while
// unmerged → merged by a human → the merge recorded by `l2 run` → repairs only in a repair run, and the slice's next run
// may start. Recording checks the observed PR and main; it never merges.

const T0 = "2026-10-31T00:00:00.000Z";
const SLICE: L2Slice = { id: "d1-1", domain: "d1", domainTitle: "Domain One", ordinal: "01", index: 1, groups: [{ group: "g1", title: "Group One", concepts: ["a", "b"] }, { group: "g2", title: "Group Two", concepts: ["s", "t", "u"] }] };
const record = (conceptId: string): MapConceptContent => ({ id: `${conceptId}-content`, conceptId, definition: `${conceptId} is defined.`, body: [{ kind: "paragraph", text: `How ${conceptId} works.` }] });
const plans = (): L2GroupFile[] => [{ ...filledG1(), pipeline: { mode: "simplified", version: 1 } }];

/** The g1 partial run at CI, drafted and audited, with its PR #7 pushed at "pushed". */
function atCi(authorized = false): RunState {
  const scope = selectGroups(SLICE, ["g1"]);
  const state = createL2RunState({ slice: SLICE, remaining: ["a", "b", "s", "t"], branch: l2Branch(SLICE, scope.part), baseSha: "base", now: T0, pipeline: { mode: "simplified", version: 1 }, scope });
  const steps = Object.fromEntries(["plan:g1", "author:a", "audit:a", "author:b", "audit:b", "group-audit:g1"].map((key) => [key, { at: T0 }]));
  return {
    ...state,
    stage: "ci",
    concepts: { a: { done: true, at: T0 }, b: { done: true, at: T0 } },
    pushedSha: "pushed",
    pr: { number: 7, url: "https://example.test/pull/7" },
    l2: { ...state.l2!, steps, ...(authorized ? { mergeAuthorized: { at: T0, authorization: "control" } } : {}) },
  };
}
const merged: ObservedPr = { number: 7, state: "MERGED", mergeCommit: { oid: "merge77" }, headRefOid: "pushed", headRefName: "feat/map-d1-l2-1-g1", baseRefName: "main" };
const onMain = { integration: { mergeOnMain: true, headOnMain: true } };
const reopen = (state: RunState) => reopenL2(state, { concepts: ["a"], reason: "review finding", baseline: repairBaseline(plans(), ["a"]), now: T0 });

test("without an authorization a run is done at CI, awaiting human merge; with one it goes on to its merge stage", () => {
  const done = completeStage(atCi(), "ci", T0);
  assert.equal(done.stage, "done");
  assert.equal(done.completed.merge?.detail, "awaiting human merge");
  assert.equal(done.l2!.merged, undefined);
  assert.equal(completeStage(atCi(true), "ci", T0).stage, "merge");
});

test("while the PR is unmerged, nothing is recorded and the run reopens for review", () => {
  const done = completeStage(atCi(), "ci", T0);
  assert.equal(humanMerge(done, { ...merged, state: "OPEN", mergeCommit: null }, T0, onMain), undefined);
  assert.equal(reopenPrProblem(done, { state: "OPEN" }), undefined);
  assert.equal(reopen(done).stage, "author");
  // A run that has not reached its PR has nothing to observe.
  assert.equal(reopenPrProblem({ ...done, pr: undefined }, undefined), undefined);
});

test("a human merge of exactly the pushed head, on main, is recorded on the finished run", () => {
  const done = completeStage(atCi(), "ci", T0);
  const outcome = humanMerge(done, merged, T0, onMain);
  assert.deepEqual(outcome, { merged: { sha: "merge77", at: T0, byHand: true } });
  const recorded = recordHumanMerge(done, (outcome as { merged: NonNullable<NonNullable<RunState["l2"]>["merged"]> }).merged);
  assert.equal(recorded.stage, "done");
  assert.deepEqual(recorded.l2!.merged, { sha: "merge77", at: T0, byHand: true });
  // Recording is once, on a finished run with a pushed PR.
  assert.throws(() => recordHumanMerge(recorded, recorded.l2!.merged!), /already records its merge merge77/);
  assert.throws(() => recordHumanMerge(atCi(), { sha: "m", at: T0 }), /at stage ci: its merge stage records a merge/);
  assert.throws(() => recordHumanMerge({ ...done, pr: undefined }, { sha: "m", at: T0 }), /has no pushed PR/);
});

test("another head, branch, base or PR, or a merge not on main, is refused and never recorded", () => {
  const done = completeStage(atCi(), "ci", T0);
  const problem = (pr: Partial<ObservedPr>, integration = onMain.integration) => (humanMerge(done, { ...merged, ...pr }, T0, { integration }) as { problem: string }).problem;
  assert.match(problem({ headRefOid: "other00" }), /merged at other00, but the run validated and pushed pushed/);
  assert.match(problem({ headRefName: "feat/other" }), /merged feat\/other, not the run's branch feat\/map-d1-l2-1-g1/);
  assert.match(problem({ baseRefName: "release" }), /merged into release, not main/);
  assert.match(problem({ number: 8 }), /PR #8 is not the run's PR #7/);
  assert.match(problem({}, { mergeOnMain: false, headOnMain: true }), /merge commit merge77 is not on main/);
  assert.match(problem({}, { mergeOnMain: true, headOnMain: false }), /pushed head pushed is not on main/);
  // Every mismatch is reported at once.
  assert.equal(problem({ headRefOid: "other00", baseRefName: "release" }).split("; ").length, 2);
});

test("once the PR is merged, reopen is refused, recorded or not, and so is a PR that cannot be read", () => {
  const done = completeStage(atCi(), "ci", T0);
  assert.match(reopenPrProblem(done, { state: "MERGED" })!, /PR #7 is merged: record the merge \(`l2 run --domain d1-1-g1`\), then repair in a new run \(`l2 start --slice d1-1 --repair \.\.`\)/);
  assert.match(reopenPrProblem(done, undefined)!, /cannot read PR #7, so whether it merged is unknown/);
  const recorded = recordHumanMerge(done, { sha: "merge77", at: T0, byHand: true });
  assert.throws(() => reopen(recorded), (error) => error instanceof RunStateError && /merging or merged: repair in a new run/.test(error.message));
});

test("post-merge repair: refused until the merge is recorded, then the repair run builds on it", () => {
  const done = completeStage(atCi(), "ci", T0);
  const repair = (original: RunState) => createL2RepairRunState(original, { id: "d1-1-repair-1", concepts: ["a"], reason: "finding after merge", baseline: repairBaseline(plans(), ["a"]), branch: "fix/map-d1-l2-1-repair-1", baseSha: "main", now: T0 });
  assert.throws(() => repair(done), /d1-1-g1 is not merged/);
  const run = repair(recordHumanMerge(done, { sha: "merge77", at: T0, byHand: true }));
  assert.deepEqual(run.l2!.repairOf, { run: "d1-1-g1", merged: "merge77" });
  assert.deepEqual(run.plan.eligible, ["a"]);
});

test("continuation waits for the recorded merge; legacy runs without a PR are unaffected", () => {
  const done = completeStage(atCi(), "ci", T0);
  const finished = finishedConcepts(model([record("a"), record("b")]), []);
  const problems = (run: RunState) => partialStartProblems({ runs: [run], finished, id: "d1-1-g2" });
  assert.match(problems(done).join(), /d1-1-g1 finished and its concepts are on main, but the merge of its PR #7 is not recorded: `l2 run --domain d1-1-g1` records it/);
  assert.deepEqual(problems(recordHumanMerge(done, { sha: "merge77", at: T0, byHand: true })), []);
  // A run merged by its own merge stage records the merge as before.
  assert.deepEqual(problems({ ...done, l2: { ...done.l2!, merged: { sha: "m", at: T0 } } }), []);
  assert.deepEqual(problems({ ...done, pr: undefined }), []);
  // Concepts not on main still block first.
  assert.match(partialStartProblems({ runs: [done], finished: finishedConcepts(model(), []), id: "d1-1-g2" }).join(), /not on main: integrate its PR first/);
});
