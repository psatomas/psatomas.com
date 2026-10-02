import assert from "node:assert/strict";
import test from "node:test";
import {
  completeStage,
  createL2RunState,
  gitProblems,
  invalidate,
  MAX_REPAIRS,
  nextAction,
  pendingL2Steps,
  recordL2Step,
  reopenL2,
  RepairLimitError,
  repairAllowance,
  repairLimitSubject,
  resumeRun,
  staleL2Steps,
  STAGES,
  stopRun,
  syncL2Base,
  type RunState,
} from "../orchestrator/run-state.ts";
import { pilotSlice, recordSpans, repairCommitMessage, stepKey, withRecordsFrom } from "./campaign.ts";
import type { L2ConceptWork } from "./contracts.ts";
import { filledG1, model, REGISTRY } from "./fixtures.ts";
import { repairBaseline, repairScopeProblems } from "./repair.ts";
import type { L2GroupFile } from "./territory.ts";

const T0 = "2026-10-02T00:00:00.000Z";
const T1 = "2026-10-02T01:00:00.000Z";
const T2 = "2026-10-02T02:00:00.000Z";
/** A JSON round trip, as the CLI persists state between invocations. */
const persisted = (state: RunState): RunState => JSON.parse(JSON.stringify(state));

/** A run whose concepts a and b are drafted and audited, its group audited, committed, pushed and in PR #9 with CI passing. */
function finishedRun(): RunState {
  let state = createL2RunState({ slice: pilotSlice(model(), ["g1"], REGISTRY), remaining: ["a", "b"], branch: "feat/map-l2-pilot", baseSha: "base", now: T0 });
  state = recordL2Step(state, { kind: "plan", subject: "g1" }, T0);
  for (const conceptId of ["a", "b"]) state = recordL2Step(state, { kind: "design", subject: conceptId }, T0);
  for (const conceptId of ["a", "b"]) {
    state = recordL2Step(state, { kind: "author", subject: conceptId }, T0, { fingerprint: `${conceptId}-v1` });
    state = recordL2Step(state, { kind: "audit", subject: conceptId }, T0, { fingerprint: `${conceptId}-v1` });
  }
  state = recordL2Step(state, { kind: "group-audit", subject: "g1" }, T0);
  for (const stage of STAGES.slice(STAGES.indexOf("audit"), STAGES.indexOf("ci") + 1)) {
    if (stage === "commit") state = { ...state, commits: [{ sha: "c1", message: "feat(map): author Group One L2 topics", files: ["data.ts"] }] };
    if (stage === "push") state = { ...state, pushedSha: "c1" };
    if (stage === "pr") state = { ...state, pr: { number: 9, url: "u" } };
    state = completeStage(state, stage, T0, stage === "audit" ? "audited" : undefined);
  }
  return { ...state, checks: { gates: { ok: true, at: T0, detail: "ok", tree: "tree1" } }, validatedFiles: { "data.ts": "blob1" }, ci: { status: "passing", at: T0, detail: "build" } };
}
const baseline = { work: { a: "w-a" }, members: { a: "m-a", b: "m-b" }, splits: { g1: "s-g1" } };

test("reopening a concept after review is a counted repair cycle that re-drafts and re-audits it, keeping commits and the PR", () => {
  const done = finishedRun();
  assert.equal(done.stage, "done");
  const state = reopenL2(done, { concepts: ["a"], reason: "review: a overclaims", baseline, now: T1 });
  assert.equal(state.stage, "author");
  assert.deepEqual(state.l2!.repairs, { a: 1 });
  assert.deepEqual(state.l2!.repair, { cycle: 1, at: T1, reason: "review: a overclaims", concepts: ["a"], groups: ["g1"], baseline });
  // Its drafting, its audit and its group's audit must be recorded again; b's stand.
  assert.deepEqual(pendingL2Steps(state).map(stepKey), ["author:a", "audit:a", "group-audit:g1"]);
  assert.deepEqual([state.concepts.a.done, state.concepts.b.done], [false, true]);
  // Commits, push and PR are kept; everything validated must be validated again.
  assert.deepEqual([state.commits.length, state.pushedSha, state.pr?.number], [1, "c1", 9]);
  assert.deepEqual([state.checks, state.validatedFiles, state.ci, state.completed], [{}, undefined, undefined, {}]);
  assert.match((nextAction(state) as { message: string }).message, /repair a \(cycle 1: review: a overclaims\) in a fresh context, within its accepted territory, model and design/);
});

test("a repair runs to a validated, committed result, and the cycle closes into the run's history", () => {
  let state = reopenL2(finishedRun(), { concepts: ["a"], reason: "review", baseline, now: T1 });
  state = recordL2Step(state, { kind: "author", subject: "a" }, T1, { fingerprint: "a-v2" });
  assert.match((nextAction(state) as { message: string }).message, /re-audit a in a fresh context/);
  state = recordL2Step(state, { kind: "audit", subject: "a" }, T1, { fingerprint: "a-v2" });
  assert.equal(state.stage, "audit");
  assert.match((nextAction(state) as { message: string }).message, /re-audit group g1 in a fresh context/);
  state = recordL2Step(state, { kind: "group-audit", subject: "g1" }, T1);
  for (const stage of ["audit", "gates", "browser", "render", "diff"] as const) state = completeStage(persisted(state), stage, T1, stage === "audit" ? "re-audited" : undefined);
  assert.ok(state.l2!.repair);
  state = completeStage(state, "commit", T2);
  assert.equal(state.l2!.repair, undefined);
  assert.equal(state.l2!.committed, true);
  assert.deepEqual(state.l2!.history, [{ kind: "repair", cycle: 1, at: T1, reason: "review", concepts: ["a"], closedAt: T2 }]);
  for (const stage of ["push", "pr", "ci"] as const) state = completeStage(state, stage, T2);
  assert.equal(state.stage, "done");
});

test("a repair stays within its territory, model and design unless it re-records them, and only for reopened concepts", () => {
  const work = (meaning: string) => ({ model: { meaning, kind: "mechanism" }, design: { decision: "prose" } }) as unknown as L2ConceptWork;
  const plan = (): L2GroupFile => ({ ...filledG1(), concepts: { a: work("Alpha starts things."), b: work("Beta follows.") } });
  const before = repairBaseline([plan()], ["a"]);
  const check = (plans: L2GroupFile[], redesigned: string[] = [], replanned: string[] = []) => repairScopeProblems({ baseline: before, reopened: ["a"], plans, redesigned: new Set(redesigned), replanned: new Set(replanned) });
  // Unchanged: a valid repair of the record alone.
  assert.deepEqual(check([plan()]), []);
  // The model changed: only allowed once the design is recorded again (and so validated) in the repair.
  const remodelled = plan();
  remodelled.concepts.a = work("Alpha starts everything.");
  assert.match(check([remodelled]).join(), /a: its model or design changed without being recorded again in the repair/);
  assert.deepEqual(check([remodelled], ["a"]), []);
  // The territory of a reopened concept changed: only with the plan recorded again.
  const reclaimed = plan();
  reclaimed.members.find((member) => member.conceptId === "a")!.claims = ["how alpha starts", "how alpha ends"];
  assert.match(check([reclaimed]).join(), /a: its territory changed without g1's plan being recorded again/);
  assert.deepEqual(check([reclaimed], [], ["g1"]), []);
  // The territory of a concept not reopened changed: never within this repair.
  const encroached = plan();
  encroached.members.find((member) => member.conceptId === "b")!.claims = ["how beta follows", "how alpha ends"];
  assert.match(check([encroached], [], ["g1"]).join(), /b: its territory changed, but it was not reopened/);
  const resplit = plan();
  resplit.splits = [{ concepts: ["a", "t"], split: "something else" }];
  assert.match(check([resplit]).join(), /g1: its splits changed without its plan being recorded again/);
});

test("drafting is recorded once: changing a drafted concept, its design or its territory needs it reopened", () => {
  const done = finishedRun();
  let reopened = reopenL2(done, { concepts: ["a"], reason: "review", baseline, now: T1 });
  assert.throws(() => recordL2Step(reopened, { kind: "author", subject: "b" }, T1), /b is drafted: changing it is a repair; reopen it first/);
  assert.throws(() => recordL2Step(reopened, { kind: "design", subject: "b" }, T1), /b is drafted/);
  // Within the repair, a's design and its group's plan may be recorded again (and are revalidated by the tool).
  reopened = recordL2Step(reopened, { kind: "design", subject: "a" }, T1);
  const replanned = recordL2Step(reopened, { kind: "plan", subject: "g1" }, T1);
  assert.equal(replanned.l2!.steps["plan:g1"].at, T1);
  // Without a repair covering the group, its territory is closed.
  assert.throws(() => recordL2Step({ ...done, stage: "author" }, { kind: "plan", subject: "g1" }, T1), /g1 has drafted concepts outside a repair \(a, b\)/);
});

test("re-recording an audit replaces its note without counting a repair; the group audit is recorded again too", () => {
  let state = reopenL2(finishedRun(), { concepts: ["a"], reason: "review", baseline, now: T1 });
  state = recordL2Step(state, { kind: "author", subject: "a" }, T1, { fingerprint: "a-v2" });
  state = recordL2Step(state, { kind: "audit", subject: "a" }, T1, { note: "first", fingerprint: "a-v2" });
  state = recordL2Step(state, { kind: "audit", subject: "a" }, T2, { note: "corrected note", fingerprint: "a-v2" });
  assert.deepEqual([state.l2!.steps["audit:a"].note, state.l2!.repairs.a, state.stage], ["corrected note", 1, "audit"]);
  assert.deepEqual(pendingL2Steps(state).map(stepKey), ["group-audit:g1"]);
});

test("repair cycles are counted per concept, once per cycle, and a repeated repair opens a new cycle", () => {
  let state = reopenL2(finishedRun(), { concepts: ["a"], reason: "first finding", baseline, now: T1 });
  // Reopening again, or adding b, joins the open cycle: a still counts one.
  state = reopenL2(state, { concepts: ["a", "b"], reason: "group audit", baseline: { ...baseline, work: { b: "w-b" } }, now: T1 });
  assert.deepEqual([state.l2!.repairs, state.l2!.repair!.cycle, state.l2!.repair!.concepts, state.l2!.repair!.reason], [{ a: 1, b: 1 }, 1, ["a", "b"], "first finding"]);
  assert.deepEqual(state.l2!.repair!.baseline.work, { a: "w-a", b: "w-b" });
  const closed = { ...state, stage: "commit" as const, l2: { ...state.l2!, steps: { ...finishedRun().l2!.steps } } };
  const after = completeStage(closed, "commit", T2);
  const again = reopenL2({ ...after, stage: "done" }, { concepts: ["a"], reason: "second review", baseline, now: T2 });
  assert.deepEqual([again.l2!.repairs.a, again.l2!.repair!.cycle], [2, 2]);
});

test("a third repair cycle stops the run until a human allows one more", () => {
  const cycle = (state: RunState, reason: string): RunState => {
    const reopened = reopenL2(state, { concepts: ["a"], reason, baseline, now: T1 });
    return completeStage({ ...reopened, stage: "commit", l2: { ...reopened.l2!, steps: { ...finishedRun().l2!.steps } } }, "commit", T1);
  };
  let state = cycle(cycle(finishedRun(), "one"), "two");
  assert.deepEqual([state.l2!.repairs.a, repairAllowance(state, "a"), MAX_REPAIRS], [2, 2, 2]);
  assert.throws(() => reopenL2(state, { concepts: ["a"], reason: "three", baseline, now: T2 }), (error: unknown) => error instanceof RepairLimitError && error.conceptIds.join() === "a");
  // The CLI records the stop; a human's decision resolves it and allows one more cycle.
  state = stopRun(state, { subject: repairLimitSubject("a"), evidence: "two cycles", why: "needs a human", decision: "inspect" }, T2);
  assert.throws(() => reopenL2(state, { concepts: ["a"], reason: "three", baseline, now: T2 }), /run is stopped/);
  state = resumeRun(state, "the design was wrong; corrected it, one more repair allowed", T2);
  assert.equal(repairAllowance(state, "a"), 3);
  assert.equal(reopenL2(state, { concepts: ["a"], reason: "three", baseline, now: T2 }).l2!.repairs.a, 3);
});

test("a changed record, concept audit or group audit is stale until the concept is repaired and re-audited", () => {
  const state = finishedRun();
  const observed = { records: { a: "a-v1", b: "b-v1" }, conceptAudits: { a: "a-v1", b: "b-v1" }, groupAudits: { g1: { a: "a-v1", b: "b-v1" } } };
  assert.deepEqual(staleL2Steps(state, observed), []);
  // a edited in place, outside a repair: its drafting, its audit and its group's audit no longer describe it.
  assert.deepEqual(
    staleL2Steps(state, { ...observed, records: { a: "a-v2", b: "b-v1" } }).map((entry) => entry.step),
    ["author:a", "audit:a", "group-audit:g1"],
  );
  // The group audit alone bound to an older record.
  assert.deepEqual(staleL2Steps(state, { ...observed, groupAudits: { g1: { a: "a-v0", b: "b-v1" } } }), [{ step: "group-audit:g1", reason: "g1's group audit judged different records of a" }]);
  // Once reopened, the stale steps are gone: they are pending again.
  assert.deepEqual(staleL2Steps(reopenL2(state, { concepts: ["a"], reason: "edit", baseline, now: T1 }), { ...observed, records: { a: "a-v2", b: "b-v1" } }), []);
});

test("an interrupted repair resumes where it left off; uncommitted repair content is expected on top of the commits", () => {
  const observed = { branch: "feat/map-l2-pilot", head: "c1", baseIsAncestor: true, trackedChanges: ["src/lib/map/data.ts"], remoteHead: "c1" };
  // Without a repair, content on top of the commits is refused, and named as a repair to open.
  assert.match(gitProblems(finishedRun(), observed).join(), /tracked changes after the run's commits: src\/lib\/map\/data\.ts; changing committed content is a repair/);
  let state = persisted(reopenL2(finishedRun(), { concepts: ["a"], reason: "review", baseline, now: T1 }));
  assert.deepEqual(gitProblems(state, observed), []);
  state = persisted(recordL2Step(state, { kind: "author", subject: "a" }, T1, { fingerprint: "a-v2" }));
  assert.deepEqual(pendingL2Steps(state).map(stepKey), ["audit:a", "group-audit:g1"]);
  // A repair edited again after its audit completed returns to the audit, though the run has commits.
  state = recordL2Step(recordL2Step(state, { kind: "audit", subject: "a" }, T1, { fingerprint: "a-v2" }), { kind: "group-audit", subject: "g1" }, T1);
  state = { ...completeStage(state, "audit", T1, "ok"), auditContent: "content-v2" };
  const rewound = invalidate(state, { tree: "tree2", content: "content-v3" });
  assert.equal(rewound.state.stage, "audit");
  assert.match(rewound.reason ?? "", /content changed after the audit/);
});

test("merging a moved main rebases the run's validation without touching its content stages", () => {
  const done = finishedRun();
  const synced = syncL2Base(done, { base: "main2", merge: "m1", now: T1 });
  assert.deepEqual([synced.baseSha, synced.stage, synced.commits.at(-1)], ["main2", "gates", { sha: "m1", message: "Merge origin/main into feat/map-l2-pilot", files: [] }]);
  assert.deepEqual([synced.completed.author !== undefined, synced.completed.audit !== undefined, synced.completed.gates, synced.checks, synced.validatedFiles], [true, true, undefined, {}, undefined]);
  assert.deepEqual(synced.l2!.history, [{ kind: "sync", at: T1, from: "base", to: "main2", merge: "m1" }]);
  assert.deepEqual(gitProblems(synced, { branch: "feat/map-l2-pilot", head: "m1", baseIsAncestor: true, trackedChanges: [], remoteHead: "c1" }), []);
  assert.throws(() => syncL2Base(reopenL2(done, { concepts: ["a"], reason: "r", baseline, now: T1 }), { base: "main2", merge: "m1", now: T1 }), /a repair is open/);
  const fresh = createL2RunState({ slice: pilotSlice(model(), ["g1"], REGISTRY), remaining: ["a", "b"], branch: "feat/map-l2-pilot", baseSha: "base", now: T0 });
  assert.throws(() => syncL2Base(fresh, { base: "main2", merge: "m1", now: T1 }), /has not committed yet/);
});

test("reopening is refused for what cannot be repaired", () => {
  const done = finishedRun();
  assert.throws(() => reopenL2(done, { concepts: ["a"], reason: " ", baseline, now: T1 }), /needs its reason/);
  assert.throws(() => reopenL2(done, { concepts: ["zzz"], reason: "r", baseline, now: T1 }), /zzz is not a concept of slice pilot/);
  assert.throws(() => reopenL2({ ...done, l2: { ...done.l2!, merged: { sha: "m", at: T1 } } }, { concepts: ["a"], reason: "r", baseline, now: T1 }), /merging or merged/);
  const undrafted = createL2RunState({ slice: pilotSlice(model(), ["g1"], REGISTRY), remaining: ["a", "b"], branch: "feat/map-l2-pilot", baseSha: "base", now: T0 });
  assert.throws(() => reopenL2(undrafted, { concepts: ["a"], reason: "r", baseline, now: T1 }), /a is not drafted yet/);
});

const DATA = (a: string, b: string) => ["export const mapKnowledge = {", "  content: [", "    {", '      id: "a-content",', `      definition: "${a}",`, "    },", "    {", '      id: "b-content",', `      definition: "${b}",`, '      body: [{ kind: "paragraph", text: "x" }],', "    },", "  ],", "};", ""].join("\n");

test("a repair commit takes only its group's repaired records from the validated tree", () => {
  const committed = DATA("A one.", "B one.");
  const final = DATA("A two.", "B two, now longer.");
  const afterA = withRecordsFrom(committed, final, ["a"]);
  assert.equal(afterA, DATA("A two.", "B one."));
  assert.equal(withRecordsFrom(afterA, final, ["b"]), final);
  assert.deepEqual([...recordSpans(final).keys()], ["a", "b"]);
  assert.throws(() => withRecordsFrom(committed, final, ["zzz"]), /no record block for zzz/);
  const message = repairCommitMessage({ title: "Group One", repaired: ["a"] }, { cycle: 2, reason: "review: overclaim" }, "Trailer: x");
  assert.deepEqual(message.split("\n").slice(0, 3), ["fix(map): repair Group One L2 topics", "", "Repair cycle 2: review: overclaim"]);
  assert.match(message, /Trailer: x$/);
});
