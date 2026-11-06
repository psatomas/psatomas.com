import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { completeStage, createL2RunState, recordL2Step, reopenL2, stopRun, type RunState } from "../orchestrator/run-state.ts";
import type { L2Attempt, L2AttemptStatus, L2AttemptStep } from "./attempts.ts";
import type { L2BudgetStatus } from "./budget.ts";
import type { L2Slice } from "./campaign.ts";
import { batchProblems, bindingDrift, l2Next, l2NoRun, MAX_BATCH_CONCEPTS, NEXT_SCHEMA, NEXT_VERSION, planBatches, stepFreshness, type L2Next, type L2NextInput } from "./orchestration.ts";
import type { L2Pipeline } from "./pipeline.ts";

const T0 = "2026-11-06T00:00:00.000Z";
const V2: L2Pipeline = { mode: "simplified", version: 2 };
const V1: L2Pipeline = { mode: "simplified", version: 1 };
const ROOT = new URL("../../../../../", import.meta.url).pathname;

const sliceOf = (groups: { group: string; concepts: string[] }[], id = "d-1"): L2Slice => ({ id, domain: "d", domainTitle: "D", ordinal: "1", index: 1, groups: groups.map((group) => ({ ...group, title: group.group })) });
const G1 = { group: "g1", concepts: ["a", "b"] };
const G2 = { group: "g2", concepts: ["s", "t"] };

/** A run of `groups` under `pipeline`, every plan recorded. */
function runOf(groups: { group: string; concepts: string[] }[], pipeline?: L2Pipeline, extra: { pilot?: boolean } = {}): RunState {
  let state = createL2RunState({ slice: sliceOf(groups), remaining: groups.flatMap((group) => group.concepts), branch: "feat/map-d-l2-1", baseSha: "base", now: T0, ...(pipeline ? { pipeline } : {}), ...extra });
  for (const group of groups) state = recordL2Step(state, { kind: "plan", subject: group.group }, T0);
  return state;
}
const rec = (state: RunState, kind: "design" | "author" | "audit" | "group-audit", subject: string) => recordL2Step(state, { kind, subject }, T0, kind === "author" ? { fingerprint: `${subject}-v1` } : {});

const BUDGET: L2BudgetStatus = { capUsd: 50, spentUsd: 4.004, reservedUsd: 3, headroomUsd: 5, availableUsd: 37.996, open: [{ id: "x", role: "author", heldUsd: 3, spentUsd: 0, at: T0, reporting: true }], unknown: [] };

function input(state: RunState, over: Partial<L2NextInput> = {}): L2NextInput {
  return {
    state,
    journal: false,
    freshness: { drafts: {}, audits: {}, groupAudits: {} },
    tracked: Boolean(state.l2?.attempts),
    attempts: [],
    drafts: {},
    audits: {},
    budget: { status: BUDGET, refused: {} },
    governance: { mergeAuthorized: false, hookRegistered: true },
    taskOf: (attempt) => `Task ${attempt.step.subject} #${attempt.id}`,
    inboxOf: (subject, role, auditor) => `.map-authoring/l2/work/d-1/inbox/${subject}/${role}-${auditor}/findings.json`,
    ...over,
  };
}

const attempt = (id: string, step: L2AttemptStep, status: L2AttemptStatus): L2Attempt => ({ version: 1, id, run: "d-1", step, pipeline: { mode: "simplified", version: 2 }, inputs: {}, inputKey: "k", status, createdAt: T0, updatedAt: T0, history: [] });
const stepOf = (view: L2Next, key: string) => view.steps.find((step) => step.key === key);
const codes = (view: L2Next) => view.blockers.map((blocker) => `${blocker.code} ${blocker.subject}`);

test("the schema is versioned and stable: one fixed shape, field order and meaning", () => {
  const state = rec(runOf([G1], V2), "author", "a");
  const view = l2Next(input(state));
  assert.deepEqual(JSON.parse(JSON.stringify(view)), {
    schema: "map-l2-next",
    version: 1,
    commandPrefix: "npm run map:author --",
    run: { id: "d-1", slice: "d-1", stage: "author", pipeline: { mode: "simplified", version: 2, batched: true }, tracksAttempts: true, scope: null, repair: null, pr: null },
    governance: { merge: "human-only", hookRegistered: true, paidExecution: "attended-only" },
    details: { status: "l2 status", attempts: "l2 attempts --json", budget: "l2 budget --json", check: "l2 check --json" },
    state: "actionable",
    batch: { maxConcepts: 12, concepts: 2, withinLimit: true, groups: [{ group: "g1", concepts: ["a", "b"], status: "active" }], problems: [] },
    progress: { steps: 6, recorded: 2, stale: 0, remaining: 4 },
    steps: [
      { key: "author:b", kind: "author", subject: "b", group: "g1", dependsOn: ["author:a"], status: "actionable", units: [{ role: "author", output: "none", expects: { kind: "record", concept: "b" } }], operations: [{ op: "begin-attempt", actor: "driver", paid: false, role: "author", command: "l2 attempt begin author b --role author" }] },
      { key: "audit:a", kind: "audit", subject: "a", group: "g1", dependsOn: ["author:b"], status: "pending" },
      { key: "audit:b", kind: "audit", subject: "b", group: "g1", dependsOn: ["author:b"], status: "pending" },
      { key: "group-audit:g1", kind: "group-audit", subject: "g1", group: "g1", dependsOn: ["audit:b"], status: "pending" },
    ],
    freshness: { stale: [], unbound: [] },
    attempts: { counts: { pending: 0, running: 0, completed: 0, committed: 0, failed: 0, interrupted: 0 }, open: [] },
    budget: { capUsd: 50, spentUsd: 4, reservedUsd: 3, heldUsd: 0, headroomUsd: 5, availableUsd: 38, openLaunches: 1, unknown: 0, launchAllowed: {} },
    blockers: [],
    permitted: ["begin-attempt"],
    operations: [],
  });
  assert.equal(NEXT_SCHEMA, "map-l2-next");
  assert.equal(NEXT_VERSION, 1);
  // Without a single active run the view says so, in the same schema.
  assert.deepEqual(l2NoRun(["z", "y"]), { schema: "map-l2-next", version: 1, commandPrefix: "npm run map:author --", state: "ambiguous", runs: ["y", "z"], details: { choose: "l2 next --json --domain <run>" } });
  assert.equal(l2NoRun([]).state, "no-run");
});

test("identical persisted state gives byte-identical JSON, whatever order its maps were built in", () => {
  let state = runOf([G1], V2);
  state = rec(rec(rec(rec(state, "author", "a"), "author", "b"), "audit", "a"), "audit", "b");
  const forward = { drafts: { a: { bound: "a-v1", current: "a-v1" }, b: { bound: "b-v1", current: "b-v1" } }, audits: { a: { record: { bound: "A", current: "A" }, neighbours: { bound: { b: "B", n: "N1", m: "M" }, current: { m: "M", n: "N2", b: "B" } } } }, groupAudits: {} };
  const backward = { drafts: { b: { bound: "b-v1", current: "b-v1" }, a: { bound: "a-v1", current: "a-v1" } }, audits: { a: { record: { bound: "A", current: "A" }, neighbours: { bound: { n: "N1", m: "M", b: "B" }, current: { b: "B", n: "N2", m: "M" } } } }, groupAudits: {} };
  const attempts = [attempt("att-0002", { kind: "group-audit", subject: "g1", role: "group-audit", auditor: "G" }, "running"), attempt("att-0001", { kind: "audit", subject: "a", role: "first-audit", auditor: "A" }, "committed")];
  const one = JSON.stringify(l2Next(input(state, { freshness: forward, attempts })));
  const two = JSON.stringify(l2Next(input(JSON.parse(JSON.stringify(state)), { freshness: backward, attempts: JSON.parse(JSON.stringify(attempts)) })));
  assert.equal(one, two);
  assert.equal(JSON.stringify(l2Next(input(state, { freshness: forward, attempts }))), one);
  // No clock: nothing in the view is a timestamp, though the state and attempts carry them.
  assert.doesNotMatch(one, /2026-11-06/);
});

test("a recorded audit whose bound neighbour changed or disappeared is stale, with which records and how", () => {
  assert.deepEqual(bindingDrift({ b: "1", n: "1", gone: "1" }, { b: "1", n: "2", fresh: "1" }), [
    { concept: "fresh", drift: "added" },
    { concept: "gone", drift: "removed" },
    { concept: "n", drift: "changed" },
  ]);
  const freshness = {
    drafts: {},
    audits: {
      a: { record: { bound: "A", current: "A" }, neighbours: { bound: { b: "B", n: "N1", gone: "G" }, current: { b: "B", n: "N2", later: "L" } } },
      b: { record: { bound: "B0", current: "B" }, neighbours: { bound: { a: "A" }, current: { a: "A" } } },
      // Recorded before neighbours were bound: only its own record counts, as when it was validated.
      c: { record: { bound: "C", current: "C" } },
    },
    groupAudits: { g1: { bound: { a: "A", b: "B0", x: "X" }, current: { a: "A", b: "B", y: "Y" } } },
  };
  assert.deepEqual(stepFreshness("audit:a", freshness), { stale: [{ kind: "neighbour-removed", concept: "gone" }, { kind: "neighbour-changed", concept: "n" }], unbound: ["later"] });
  assert.deepEqual(stepFreshness("audit:b", freshness).stale, [{ kind: "record-changed", concept: "b" }]);
  assert.deepEqual(stepFreshness("audit:c", freshness), { stale: [], unbound: [] });
  assert.deepEqual(stepFreshness("group-audit:g1", freshness).stale, [{ kind: "member-changed", concept: "b" }, { kind: "member-removed", concept: "x" }, { kind: "member-added", concept: "y" }]);

  // In the view: the stale audit is never presented as current; its own-record change asks for a repair, a neighbour's for a re-audit.
  let state = runOf([G1], V2);
  state = rec(rec(rec(rec(state, "author", "a"), "author", "b"), "audit", "a"), "audit", "b");
  const view = l2Next(input(state, { freshness: { drafts: {}, audits: { a: freshness.audits.a, b: freshness.audits.b }, groupAudits: {} } }));
  assert.deepEqual(view.freshness.stale.map((entry) => [entry.step, entry.resolution, entry.command]), [
    ["audit:a", "re-audit", "l2 audit-task a --role first-audit --auditor <A|B>"],
    ["audit:b", "reopen", 'l2 reopen b --reason ".."'],
  ]);
  assert.deepEqual(view.freshness.unbound, [{ step: "audit:a", concepts: ["later"] }]);
  assert.deepEqual(stepOf(view, "audit:a"), { key: "audit:a", kind: "audit", subject: "a", group: "g1", dependsOn: ["author:b"], status: "stale", reasons: ["gone (neighbour-removed), n (neighbour-changed)"] });
  assert.deepEqual(codes(view), ["stale-audit audit:a", "stale-audit audit:b"]);
  assert.ok(view.blockers.every((blocker) => blocker.actor === "human"));
  assert.equal(view.progress?.stale, 2);
  // A draft changed outside a repair is stale too.
  const draft = l2Next(input(state, { freshness: { drafts: { a: { bound: "a-v1", current: "a-v2" } }, audits: {}, groupAudits: {} } }));
  assert.deepEqual(draft.freshness.stale.map((entry) => [entry.step, entry.resolution]), [["author:a", "reopen"]]);
  assert.equal(draft.blockers[0].code, "stale-draft");
});

test("an interrupted attempt blocks its step for a human; other auditors stay independent", () => {
  let state = runOf([G1], V2);
  state = rec(rec(state, "author", "a"), "author", "b");
  const attempts = [
    attempt("att-a-A", { kind: "audit", subject: "a", role: "first-audit", auditor: "A" }, "completed"),
    attempt("att-b-A", { kind: "audit", subject: "b", role: "first-audit", auditor: "A" }, "interrupted"),
    attempt("att-b-B", { kind: "audit", subject: "b", role: "first-audit", auditor: "B" }, "pending"),
  ];
  const audits = { "audit:a": { submitted: [{ role: "first-audit", auditor: "A" }], outcome: "missing" as const }, "audit:b": { submitted: [], outcome: "missing" as const } };
  const view = l2Next(input(state, { attempts, audits }));
  // Both concepts' first audits may run at once once every draft is in; a's B is begun independently of A.
  assert.equal(stepOf(view, "audit:a")?.status, "actionable");
  assert.deepEqual(stepOf(view, "audit:a")?.units?.map((unit) => [unit.auditor, unit.output, unit.attempt?.status ?? null]), [["A", "present", "completed"], ["B", "none", null]]);
  assert.deepEqual(stepOf(view, "audit:a")?.operations, [{ op: "begin-attempt", actor: "driver", paid: false, role: "first-audit", command: "l2 audit-task a --role first-audit --auditor B" }]);
  // b's A was interrupted: its outcome is unknown, so the step waits for a human, even though B could launch.
  assert.equal(stepOf(view, "audit:b")?.status, "blocked");
  assert.equal(stepOf(view, "audit:b")?.operations, undefined);
  assert.deepEqual(view.blockers.map((blocker) => [blocker.code, blocker.subject, blocker.actor, blocker.command]), [["attempt-interrupted", "att-b-A", "human", 'l2 attempt decide att-b-A --relaunch|--abandon --reason ".."']]);
  assert.deepEqual(view.permitted, ["begin-attempt", "reconcile"]);
  assert.deepEqual(view.attempts?.open.map((entry) => entry.id), ["att-a-A", "att-b-A", "att-b-B"]);
  // A pending attempt is launched with its own marker; a running one is waited for.
  const later = l2Next(input(state, { attempts: [attempt("att-a-A", { kind: "audit", subject: "a", role: "first-audit", auditor: "A" }, "running"), attempt("att-a-B", { kind: "audit", subject: "a", role: "first-audit", auditor: "B" }, "pending")], audits: { "audit:a": { submitted: [], outcome: "missing" } } }));
  assert.deepEqual(stepOf(later, "audit:a")?.operations, [{ op: "launch-agent", actor: "driver", paid: true, role: "first-audit", task: "Task a #att-a-B" }]);
  // An attempt that completed without its draft in data.ts is reconciled, never begun again.
  const vanished = l2Next(input(rec(runOf([G1], V2), "author", "a"), { attempts: [attempt("att-v", { kind: "author", subject: "b", role: "author" }, "completed")] }));
  assert.deepEqual([stepOf(vanished, "author:b")?.status, stepOf(vanished, "author:b")?.operations?.map((op) => op.op), vanished.operations.map((op) => op.op)], ["waiting", ["reconcile"], ["reconcile"]]);
  // An interrupted draft blocks drafting.
  const drafting = l2Next(input(rec(runOf([G1], V2), "author", "a"), { attempts: [attempt("att-d", { kind: "author", subject: "b", role: "author" }, "interrupted")] }));
  assert.equal(drafting.state, "blocked");
  assert.deepEqual(codes(drafting), ["attempt-interrupted att-d"]);
});

test("an unrecovered commit journal is reported, never recovered, and nothing else is read from the state", () => {
  const view = l2Next(input(rec(runOf([G1], V2), "author", "a"), { journal: true, budget: undefined }));
  assert.equal(view.state, "recovery-required");
  assert.deepEqual([view.steps, view.batch, view.progress, view.attempts, view.budget, view.permitted], [[], null, null, null, null, ["recover-journal"]]);
  assert.deepEqual(view.operations, [{ op: "recover-journal", actor: "driver", paid: false, command: "l2 reconcile" }]);
  assert.deepEqual(view.blockers.map((blocker) => [blocker.code, blocker.command]), [["journal-unrecovered", "l2 reconcile"]]);
});

test("batches: whole groups in slice order, at most 12 concepts, deterministic, never a split group", () => {
  const sized = (name: string, n: number) => ({ group: name, title: name, concepts: Array.from({ length: n }, (_, index) => `${name}-${index + 1}`) });
  const slice = { id: "x-1", groups: [sized("g1", 6), sized("g2", 6), sized("g3", 5), sized("g4", 13), sized("g5", 2), sized("g6", 4), sized("g7", 3)] };
  const remaining = new Set(slice.groups.flatMap((group) => group.concepts));
  const plan = planBatches({ slice, remaining, pipeline: "simplified" });
  assert.equal(plan.maxConcepts, MAX_BATCH_CONCEPTS);
  assert.deepEqual(plan.batches.map((batch) => [batch.groups.map((group) => group.group), batch.concepts]), [[["g1", "g2"], 12], [["g3"], 5], [["g4"], 13], [["g5", "g6", "g7"], 9]]);
  assert.match(plan.batches[2].problems.join(), /13 concepts exceed the batch limit of 12/);
  assert.ok(plan.batches.filter((batch) => batch.index !== 3).every((batch) => !batch.problems.length && batch.concepts <= 12));
  assert.equal(plan.batches[0].command, "l2 start --slice x-1 --groups g1,g2 --pipeline simplified --budget-usd <usd>");
  assert.equal(plan.startable, true);
  assert.deepEqual(planBatches({ slice, remaining, pipeline: "simplified" }), plan);
  // Integrated groups and groups an open run holds are left out; while a run is open, nothing starts.
  const partial = planBatches({ slice: { id: "x-1", groups: slice.groups.slice(0, 3) }, remaining: new Set([...slice.groups[1].concepts, ...slice.groups[2].concepts]), claimed: { g2: "x-1-g2" }, openRuns: ["x-1-g2"] });
  assert.deepEqual([partial.integrated, partial.claimed, partial.batches.map((batch) => batch.groups.map((group) => group.group)), partial.startable], [["g1"], [{ group: "g2", run: "x-1-g2" }], [["g3"]], false]);
  // One batch holding every group of the slice is a full-slice run.
  assert.equal(planBatches({ slice: { id: "y-1", groups: [sized("h1", 3)] }, remaining: new Set(sized("h1", 3).concepts) }).batches[0].command, "l2 start --slice y-1 --budget-usd <usd>");
  // A run's own batch is validated the same way.
  assert.deepEqual(batchProblems([{ group: "g1", concepts: ["a", "b"] }, { group: "g2", concepts: ["b"] }, { group: "g1", concepts: [] }]), ["b is in both g1 and g2", "group g1 has no concepts to author", "groups named twice: g1"]);
  const big = l2Next(input(runOf([sized("g1", 7), sized("g2", 6)], V2)));
  assert.equal(big.batch?.withinLimit, false);
  assert.deepEqual(codes(big), ["batch-too-large d-1"]);
});

test("group ordering: drafts before audits, audits recorded in order, the group audit last, then the next group", () => {
  let state = runOf([G1, G2], V2);
  let view = l2Next(input(state));
  assert.deepEqual(view.steps.filter((step) => step.status === "actionable").map((step) => step.key), ["author:a"]);
  assert.deepEqual(stepOf(view, "author:s")?.dependsOn, ["group-audit:g1"]);
  state = rec(rec(state, "author", "a"), "author", "b");
  view = l2Next(input(state));
  // Every first audit of g1 may run now; g1's group audit and g2's drafts wait.
  assert.deepEqual(view.steps.map((step) => [step.key, step.status]), [["audit:a", "actionable"], ["audit:b", "actionable"], ["group-audit:g1", "pending"], ["author:s", "pending"], ["author:t", "pending"], ["audit:s", "pending"], ["audit:t", "pending"], ["group-audit:g2", "pending"]]);
  assert.deepEqual(view.batch?.groups.map((group) => group.status), ["active", "pending"]);
  // b's audits are complete before a's: b waits to be recorded after a; a, once complete, is recorded first.
  const both = { submitted: [{ role: "first-audit", auditor: "A" }, { role: "first-audit", auditor: "B" }], outcome: "record" as const };
  view = l2Next(input(state, { audits: { "audit:b": both, "audit:a": { submitted: [], outcome: "missing" } } }));
  assert.deepEqual([stepOf(view, "audit:b")?.status, stepOf(view, "audit:b")?.reasons], ["waiting", ["every auditor has submitted; it is recorded after audit:a"]]);
  view = l2Next(input(state, { audits: { "audit:a": both, "audit:b": both } }));
  assert.deepEqual(stepOf(view, "audit:a")?.operations, [{ op: "record-step", actor: "driver", paid: false, command: "l2 record audit a" }]);
  state = rec(rec(state, "audit", "a"), "audit", "b");
  view = l2Next(input(state));
  assert.deepEqual(stepOf(view, "group-audit:g1")?.units?.map((unit) => [unit.role, unit.auditor]), [["group-audit", "G"]]);
  state = rec(state, "group-audit", "g1");
  view = l2Next(input(state));
  assert.deepEqual(view.batch?.groups.map((group) => group.status), ["done", "active"]);
  assert.deepEqual(view.steps.filter((step) => step.status === "actionable").map((step) => step.key), ["author:s"]);
  // A blocking finding reopens the concept (a counted repair), until the repair limit, which is a human's decision.
  const blocking = { submitted: both.submitted, outcome: "blocking" as const, concepts: ["a"] };
  const repairable = rec(rec(runOf([G1], V2), "author", "a"), "author", "b");
  assert.deepEqual(stepOf(l2Next(input(repairable, { audits: { "audit:a": blocking } })), "audit:a")?.operations, [{ op: "reopen", actor: "driver", paid: false, command: "l2 reopen a --from-findings" }]);
  const atLimit: RunState = { ...repairable, l2: { ...repairable.l2!, repairs: { a: 2 } } };
  const limited = l2Next(input(atLimit, { audits: { "audit:a": blocking } }));
  assert.equal(stepOf(limited, "audit:a")?.status, "blocked");
  assert.deepEqual(codes(limited), ["repair-limit a"]);
  // A repair reopened in an earlier group holds every later audit, though that group's own drafts are all recorded.
  let later = rec(rec(rec(rec(rec(runOf([G1, G2], V2), "author", "a"), "author", "b"), "audit", "a"), "audit", "b"), "group-audit", "g1");
  later = rec(rec(later, "author", "s"), "author", "t");
  const held = l2Next(input(reopenL2(later, { concepts: ["a"], reason: "fix", baseline: { territory: "t", records: {} } as never, now: T0 })));
  assert.deepEqual(held.steps.filter((step) => step.status === "actionable").map((step) => step.key), ["author:a"]);
  assert.deepEqual([stepOf(held, "audit:s")?.status, stepOf(held, "audit:t")?.status], ["pending", "pending"]);
  // A repair re-drafts with its own role and is re-audited by R.
  const reopened = reopenL2(rec(rec(repairable, "audit", "a"), "audit", "b"), { concepts: ["a"], reason: "fix", baseline: { territory: "t", records: {} } as never, now: T0 });
  const repairing = l2Next(input(reopened));
  assert.deepEqual(repairing.run.repair, { cycle: 1, concepts: ["a"] });
  assert.deepEqual(stepOf(repairing, "author:a")?.operations?.[0].command, "l2 attempt begin author a --role repair");
});

test("budget: a refused, unknown or missing cap, or an unregistered hook, blocks only paid work", () => {
  let state = runOf([G1], V2);
  state = rec(rec(state, "author", "a"), "author", "b");
  const both = { submitted: [{ role: "first-audit", auditor: "A" }, { role: "first-audit", auditor: "B" }], outcome: "record" as const };
  const refused = l2Next(input(state, { budget: { status: { ...BUDGET, availableUsd: 1 }, refused: { "first-audit": "a first-audit launch reserves $3.00, but only $1.00 is available", author: undefined } }, audits: { "audit:a": both, "audit:b": { submitted: [], outcome: "missing" } } }));
  // Recording submitted findings costs nothing and stays actionable; launching b's auditors is refused.
  assert.equal(stepOf(refused, "audit:a")?.status, "actionable");
  assert.equal(stepOf(refused, "audit:b")?.status, "blocked");
  assert.deepEqual(codes(refused), ["budget-refused audit:b"]);
  assert.deepEqual(refused.budget?.launchAllowed, { author: true, "first-audit": false });
  assert.deepEqual(refused.permitted, ["record-step"]);
  const unknown = l2Next(input(state, { budget: { status: { ...BUDGET, unknown: ["model x has no list price"] }, refused: { "first-audit": "the run's spend cannot be measured" } } }));
  assert.deepEqual(codes(unknown), ["budget-unknown d-1", "budget-refused audit:a", "budget-refused audit:b"]);
  assert.equal(unknown.state, "blocked");
  assert.deepEqual(codes(l2Next(input(state, { budget: undefined }))), ["budget-missing audit:a", "budget-missing audit:b"]);
  assert.deepEqual(codes(l2Next(input(state, { governance: { mergeAuthorized: false, hookRegistered: false } }))), ["hook-unregistered audit:a", "hook-unregistered audit:b"]);
  // One gate refusing both auditors is one reason, not two.
  assert.equal(stepOf(l2Next(input(state, { governance: { mergeAuthorized: false, hookRegistered: false } })), "audit:a")?.reasons?.length, 1);
  // Every paid operation says so: a driver runs them only attended.
  const view = l2Next(input(state));
  assert.ok(view.steps.flatMap((step) => step.operations ?? []).every((op) => op.paid === (op.op === "launch-agent" || op.op === "run-agent" || op.op === "author-plan" || op.op === "author-design")));
  assert.equal(view.governance.paidExecution, "attended-only");
});

test("merging stays human-only: a done or merge-stage run awaits a human, and no driver operation merges", () => {
  const done = completeStage({ ...runOf([G1], V2), stage: "merge" as const, pr: { number: 7, url: "u" } }, "merge", T0);
  const awaiting = l2Next(input({ ...done, stage: "done" }));
  assert.deepEqual([awaiting.state, awaiting.governance.merge], ["awaiting-merge", "human-only"]);
  assert.deepEqual(awaiting.blockers.map((blocker) => [blocker.code, blocker.subject, blocker.actor]), [["merge-awaits-human", "#7", "human"]]);
  assert.deepEqual(awaiting.permitted, []);
  const atMerge = { ...runOf([G1], V2), stage: "merge" as const, pr: { number: 7, url: "u" } };
  assert.equal(l2Next(input(atMerge)).state, "awaiting-merge");
  // Only a recorded, unrevoked human authorization lets the run's own tool stages merge.
  assert.deepEqual([l2Next(input(atMerge, { governance: { mergeAuthorized: true, hookRegistered: true } })).state, l2Next(input(atMerge, { governance: { mergeAuthorized: true, hookRegistered: true } })).governance.merge], ["tool-stages", "authorized"]);
  const merged = l2Next(input({ ...done, stage: "done", l2: { ...done.l2!, merged: { sha: "m", at: T0, byHand: true } } }));
  assert.equal(merged.state, "done");
  // No view ever permits a human's operation (merge, resume, decide, checkpoint, budget) to a driver.
  const stopped = l2Next(input(stopRun(runOf([G1], V2), { subject: "repair limit: a", evidence: "e", why: "w", decision: "d" }, T0)));
  assert.equal(stopped.state, "stopped");
  assert.deepEqual(stopped.blockers.map((blocker) => [blocker.code, blocker.actor]), [["run-stopped", "human"]]);
  assert.deepEqual(stopped.permitted, []);
  for (const view of [awaiting, merged, stopped]) assert.ok(view.permitted.every((op) => !/merge|resume|decide|checkpoint|budget|release/.test(op)));
});

test("legacy and simplified v1 runs are reported in their own order and audit contract, without attempts", () => {
  const legacy = l2Next(input(runOf([G1]), { tracked: false }));
  assert.deepEqual(legacy.run.pipeline, { mode: "legacy", version: 1, batched: false });
  assert.deepEqual(legacy.steps.slice(0, 2).map((step) => [step.key, step.status]), [["design:a", "actionable"], ["design:b", "pending"]]);
  assert.deepEqual(stepOf(legacy, "design:a")?.operations?.map((op) => op.command), ["l2 context a", "l2 record design a"]);
  assert.equal(legacy.attempts, null);
  let v1 = runOf([G1], V1);
  v1 = rec(v1, "author", "a");
  const view = l2Next(input(v1, { tracked: false, drafts: { a: true } }));
  assert.deepEqual(view.steps.filter((step) => step.status === "actionable").map((step) => step.key), ["audit:a"]);
  assert.deepEqual(stepOf(view, "audit:a")?.operations?.map((op) => op.command), ["l2 signals a", "l2 record audit a --audit-file <json>"]);
  assert.deepEqual(stepOf(view, "audit:a")?.units, [{ role: "first-audit", output: "none", expects: { kind: "audit-file" } }]);
  // A fresh legacy run's plans: the territory command carries no pipeline.
  const fresh = createL2RunState({ slice: sliceOf([G1]), remaining: ["a", "b"], branch: "b", baseSha: "base", now: T0 });
  assert.deepEqual(stepOf(l2Next(input(fresh, { tracked: false })), "plan:g1")?.operations?.[0].command, "l2 territory g1 --write");
  // The pilot's checkpoint holds drafting for a human.
  let pilot = runOf([G1], { mode: "legacy", version: 1 }, { pilot: true });
  pilot = rec(rec(pilot, "design", "a"), "design", "b");
  const held = l2Next(input(pilot, { tracked: false }));
  assert.deepEqual([held.state, stepOf(held, "author:a")?.status, codes(held)], ["blocked", "blocked", ["checkpoint d-1"]]);
});

test("`l2 next --json` and `l2 batches --json` run read-only from the CLI", () => {
  const stateDir = join(ROOT, ".map-authoring");
  const before = existsSync(stateDir) ? readdirSync(stateDir).sort() : undefined;
  const cli = (...args: string[]) => spawnSync(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", join(ROOT, "scripts/map-author.ts"), "l2", ...args], { cwd: ROOT, encoding: "utf8" });
  const next = cli("next", "--json", "--domain", "no-such-run-for-tests");
  assert.equal(next.status, 0, next.stderr);
  assert.deepEqual(JSON.parse(next.stdout), l2NoRun([]));
  const batches = cli("batches", "--slice", "consensus-ordering-1", "--json");
  assert.equal(batches.status, 0, batches.stderr);
  const plan = JSON.parse(batches.stdout) as ReturnType<typeof planBatches>;
  assert.equal(plan.schema, "map-l2-batches");
  assert.ok(plan.batches.length > 0 && plan.batches.every((batch) => batch.concepts <= MAX_BATCH_CONCEPTS && !batch.problems.length));
  assert.equal(cli("batches", "--slice", "consensus-ordering-1", "--json").stdout, batches.stdout);
  assert.deepEqual(existsSync(stateDir) ? readdirSync(stateDir).sort() : undefined, before);
});
