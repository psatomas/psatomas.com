import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { auditNeed, batchLimitProblem, batchStartProblem, completeStage, createL2RunState, pendingDrafts, recordL2Step, reopenL2, RunStateError, stopRun, type RunState } from "../orchestrator/run-state.ts";
import { AUDITORS, type L2AuditRole } from "./audit-artifacts.ts";
import { beginAttempt, emptyLog, type L2Attempt, type L2AttemptRole, type L2AttemptStatus, type L2AttemptStep } from "./attempts.ts";
import type { L2BudgetStatus } from "./budget.ts";
import type { L2Slice } from "./campaign.ts";
import { auditReplacement, batchProblems, bindingDrift, l2Next, l2NoRun, MAX_BATCH_CONCEPTS, NEXT_SCHEMA, NEXT_VERSION, planBatches, stepFreshness, type L2Next, type L2NextInput } from "./orchestration.ts";
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
    // Unless a test says otherwise, every attempt's inputs are the current ones.
    inputsCurrent: Object.fromEntries((over.attempts ?? []).map((entry) => [entry.id, true])),
    drafts: {},
    plans: {},
    designs: {},
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
      { key: "author:b", kind: "author", subject: "b", group: "g1", dependsOn: ["author:a"], status: "actionable", units: [{ role: "author", output: "none", expects: { kind: "record", concept: "b", record: "l2 record author b --attempt <id>" } }], operations: [{ op: "begin-attempt", actor: "driver", paid: false, command: "l2 attempt begin author b --role author" }] },
      { key: "audit:a", kind: "audit", subject: "a", group: "g1", dependsOn: ["author:b"], status: "pending" },
      { key: "audit:b", kind: "audit", subject: "b", group: "g1", dependsOn: ["author:b"], status: "pending" },
      { key: "group-audit:g1", kind: "group-audit", subject: "g1", group: "g1", dependsOn: ["audit:b"], status: "pending" },
    ],
    freshness: { stale: [], unbound: [] },
    attempts: { counts: { pending: 0, running: 0, completed: 0, committed: 0, failed: 0, interrupted: 0 }, open: [] },
    budget: { capUsd: 50, spentUsd: 4, reservedUsd: 3, heldUsd: 0, headroomUsd: 5, availableUsd: 38, openLaunches: 1, unknown: 0, launchAllowed: {} },
    blockers: [],
    permitted: ["begin-attempt"],
    attended: [],
    operations: [],
  });
  // Field order is part of the contract.
  assert.deepEqual(Object.keys(view), ["schema", "version", "commandPrefix", "run", "governance", "details", "state", "batch", "progress", "steps", "freshness", "attempts", "budget", "blockers", "permitted", "attended", "operations"]);
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
  assert.deepEqual(view.freshness.stale.map((entry) => [entry.step, entry.resolution, entry.actor, entry.command]), [
    ["audit:a", "re-audit", "attended", "l2 audit-task a --role first-audit --auditor <A|B>"],
    ["audit:b", "reopen", "human", 'l2 reopen b --reason ".."'],
  ]);
  assert.deepEqual(view.freshness.unbound, [{ step: "audit:a", concepts: ["later"] }]);
  assert.deepEqual(stepOf(view, "audit:a"), { key: "audit:a", kind: "audit", subject: "a", group: "g1", dependsOn: ["author:b"], status: "stale", reasons: ["gone (neighbour-removed), n (neighbour-changed)"] });
  assert.deepEqual(codes(view), ["stale-audit audit:a", "stale-audit audit:b"]);
  assert.deepEqual(view.blockers.map((blocker) => blocker.actor), ["attended", "human"]);
  assert.equal(view.progress?.stale, 2);
  // A draft changed outside a repair is stale too.
  const draft = l2Next(input(state, { freshness: { drafts: { a: { bound: "a-v1", current: "a-v2" } }, audits: {}, groupAudits: {} } }));
  assert.deepEqual(draft.freshness.stale.map((entry) => [entry.step, entry.resolution]), [["author:a", "reopen"]]);
  assert.equal(draft.blockers[0].code, "stale-draft");
  // Its audit is never offered as it stands: recording it would refuse until the draft is reopened.
  const unaudited = l2Next(input(rec(rec(runOf([G1], V2), "author", "a"), "author", "b"), { freshness: { drafts: { a: { bound: "a-v1", current: "a-v2" } }, audits: {}, groupAudits: {} } }));
  assert.deepEqual([stepOf(unaudited, "audit:a")?.status, stepOf(unaudited, "audit:a")?.operations, stepOf(unaudited, "audit:b")?.status], ["blocked", undefined, "actionable"]);
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
  assert.deepEqual(stepOf(view, "audit:a")?.operations, [{ op: "begin-attempt", actor: "driver", paid: false, command: "l2 audit-task a --role first-audit --auditor B" }]);
  // b's A was interrupted: its outcome is unknown, so the step waits for a human, even though B could launch.
  assert.equal(stepOf(view, "audit:b")?.status, "blocked");
  assert.equal(stepOf(view, "audit:b")?.operations, undefined);
  assert.deepEqual(view.blockers.map((blocker) => [blocker.code, blocker.subject, blocker.actor, blocker.command]), [["attempt-interrupted", "att-b-A", "human", 'l2 attempt decide att-b-A --relaunch|--abandon --reason ".."']]);
  assert.deepEqual(view.permitted, ["begin-attempt", "reconcile"]);
  assert.deepEqual(view.attempts?.open.map((entry) => entry.id), ["att-a-A", "att-b-A", "att-b-B"]);
  // A pending attempt is launched with its own marker; a running one is waited for.
  const later = l2Next(input(state, { attempts: [attempt("att-a-A", { kind: "audit", subject: "a", role: "first-audit", auditor: "A" }, "running"), attempt("att-a-B", { kind: "audit", subject: "a", role: "first-audit", auditor: "B" }, "pending")], audits: { "audit:a": { submitted: [], outcome: "missing" } } }));
  assert.deepEqual(stepOf(later, "audit:a")?.operations, [{ op: "reconcile", actor: "driver", paid: false, command: "l2 reconcile" }, { op: "launch-agent", actor: "attended", paid: true, role: "first-audit", task: "Task a #att-a-B" }]);
  // b's auditors have not begun: beginning them is the driver's; launching a's B needs a human present.
  assert.deepEqual([later.permitted, later.attended], [["begin-attempt", "reconcile"], ["launch-agent"]]);
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
  // A group larger than the limit is never split and never batched.
  assert.deepEqual(plan.batches.map((batch) => [batch.groups.map((group) => group.group), batch.concepts]), [[["g1", "g2"], 12], [["g3"], 5], [["g5", "g6", "g7"], 9]]);
  assert.deepEqual(plan.unbatchable, [{ group: "g4", concepts: 13 }]);
  assert.ok(plan.batches.every((batch) => !batch.problems.length && batch.concepts <= MAX_BATCH_CONCEPTS));
  const planned = plan.batches.flatMap((batch) => batch.groups.map((group) => group.group));
  assert.deepEqual(planned, ["g1", "g2", "g3", "g5", "g6", "g7"]);
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
  // A run past the limit (its state edited by hand) is offered nothing.
  const within = runOf([sized("g1", 6), sized("g2", 6)], V2);
  const edited: RunState = { ...within, l2: { ...within.l2!, slice: { ...within.l2!.slice, groups: [...within.l2!.slice.groups, { group: "g3", title: "g3", concepts: ["x"] }] } } };
  const big = l2Next(input(edited));
  assert.equal(big.batch?.withinLimit, false);
  assert.deepEqual([codes(big), big.permitted, big.attended, big.steps.every((step) => step.status === "blocked" || step.status === "pending")], [["batch-too-large d-1"], [], [], true]);
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
  // Recorded only once every auditor's attempt is completed for the current inputs, as `l2 record` checks.
  const tracked = rec(rec(runOf([G1], V2), "author", "a"), "author", "b");
  const running = l2Next(input(tracked, { audits: { "audit:a": { ...both, attempts: { problem: "cannot record a: attempt x (first-audit A) is running, not completed", reconcilable: true } } } }));
  assert.deepEqual([stepOf(running, "audit:a")?.status, stepOf(running, "audit:a")?.operations?.map((op) => op.op)], ["waiting", ["reconcile"]]);
  const mismatched = l2Next(input(tracked, { audits: { "audit:a": { ...both, attempts: { problem: "cannot record a: one attempt has one output", reconcilable: false } } } }));
  assert.deepEqual([stepOf(mismatched, "audit:a")?.status, codes(mismatched)], ["blocked", ["artifact-attempt audit:a"]]);
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
  assert.ok(view.steps.flatMap((step) => step.operations ?? []).every((op) => op.paid === (op.actor === "attended")));
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
  // Even under a recorded, unrevoked human authorization, a driver never runs the merge stage: a human does.
  const authorized = l2Next(input(atMerge, { governance: { mergeAuthorized: true, hookRegistered: true } }));
  assert.deepEqual([authorized.state, authorized.governance.merge, authorized.permitted, authorized.blockers.map((blocker) => blocker.actor)], ["awaiting-merge", "authorized", [], ["human"]]);
  // The tool stages a driver may run stop before any merge.
  const validating = l2Next(input({ ...runOf([G1], V2), stage: "gates" as const }));
  assert.deepEqual(validating.operations, [{ op: "run-tool-stages", actor: "driver", paid: false, command: "l2 run --until ci" }]);
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
  // A design is written (attended) before it is recorded; once it is in the group file, recording is the driver's.
  assert.deepEqual(stepOf(legacy, "design:a")?.operations?.map((op) => [op.actor, op.command]), [["attended", "l2 context a"]]);
  assert.deepEqual(stepOf(l2Next(input(runOf([G1]), { tracked: false, designs: { a: true } })), "design:a")?.operations?.map((op) => [op.actor, op.command]), [["driver", "l2 record design a"]]);
  assert.equal(legacy.attempts, null);
  let v1 = runOf([G1], V1);
  v1 = rec(v1, "author", "a");
  const view = l2Next(input(v1, { tracked: false, drafts: { a: true } }));
  assert.deepEqual(view.steps.filter((step) => step.status === "actionable").map((step) => step.key), ["audit:a"]);
  assert.deepEqual(stepOf(view, "audit:a")?.operations?.map((op) => [op.actor, op.command]), [["attended", "l2 signals a"]]);
  assert.deepEqual(stepOf(view, "audit:a")?.units, [{ role: "first-audit", output: "none", expects: { kind: "audit-file", record: "l2 record audit a --audit-file <json>" } }]);
  // Without the batch-limit marker, legacy and v1 runs of any size start as before.
  const many = Array.from({ length: 13 }, (_, index) => `c${index}`);
  for (const pipeline of [undefined, V1]) {
    const run = createL2RunState({ slice: sliceOf([{ group: "g", concepts: many }]), remaining: many, branch: "b", baseSha: "base", now: T0, ...(pipeline ? { pipeline } : {}) });
    assert.equal(run.l2?.batch, undefined);
  }
  // A fresh legacy run's plans: the territory command carries no pipeline.
  const fresh = createL2RunState({ slice: sliceOf([G1]), remaining: ["a", "b"], branch: "b", baseSha: "base", now: T0 });
  assert.deepEqual(stepOf(l2Next(input(fresh, { tracked: false })), "plan:g1")?.operations?.[0].command, "l2 territory g1 --write");
  // The pilot's checkpoint holds drafting for a human.
  let pilot = runOf([G1], { mode: "legacy", version: 1 }, { pilot: true });
  pilot = rec(rec(pilot, "design", "a"), "design", "b");
  const held = l2Next(input(pilot, { tracked: false }));
  assert.deepEqual([held.state, stepOf(held, "author:a")?.status, codes(held)], ["blocked", "blocked", ["checkpoint d-1"]]);
});

/**
 * Runs every driver operation a view advertises through the state machine the CLI command applies (run-state.ts
 * recordL2Step, reopenL2, completeStage; attempts.ts beginAttempt; the audit preconditions of audit-task), and
 * fails if any would refuse.
 */
function assertExecutable(view: L2Next, state: RunState, attempts: readonly L2Attempt[] = []) {
  const ops = [...view.steps.filter((step) => step.status === "actionable" || step.status === "waiting").flatMap((step) => step.operations ?? []), ...view.operations];
  for (const op of ops) {
    if (op.actor !== "driver") continue;
    const words = (op.command ?? "").split(" ");
    const flag = (name: string) => words[words.indexOf(name) + 1];
    const label = `${op.op}: ${op.command}`;
    if (op.op === "record-step") {
      const [, , kind, subject] = words as [string, string, "plan" | "design" | "author" | "audit" | "group-audit", string];
      assert.doesNotThrow(() => recordL2Step(state, { kind, subject }, T0, kind === "author" ? { fingerprint: `${subject}-v2` } : {}), label);
    } else if (op.op === "begin-attempt") {
      const audit = words[1] === "audit-task";
      const subject = audit ? words[2] : words[4];
      const role = flag("--role") as L2AttemptRole;
      const kind = audit ? (role === "group-audit" ? "group-audit" : "audit") : "author";
      if (audit) {
        const group = kind === "group-audit" ? subject : state.l2!.slice.groups.find((entry) => entry.concepts.includes(subject))!.group;
        assert.deepEqual(pendingDrafts(state, group), [], label);
        assert.equal(role, auditNeed(state, kind as "audit" | "group-audit", subject), label);
        assert.ok(AUDITORS[role as L2AuditRole].includes(flag("--auditor")), label);
      } else assert.equal(role, state.l2!.repair?.concepts.includes(subject) ? "repair" : "author", label);
      const step: L2AttemptStep = { kind, subject, role, ...(audit ? { auditor: flag("--auditor") } : {}) };
      assert.doesNotThrow(() => beginAttempt({ ...emptyLog(state.domainId), attempts: [...attempts] }, { step, pipeline: { mode: "simplified", version: 2 }, inputs: { fresh: "yes" }, now: T0 }), label);
    } else if (op.op === "reopen") {
      assert.doesNotThrow(() => reopenL2(state, { concepts: words[2].split(","), reason: "findings", baseline: { work: {}, members: {}, splits: {} } as never, now: T0 }), label);
    } else if (op.op === "complete-audit") {
      assert.doesNotThrow(() => completeStage(state, "audit", T0), label);
    } else if (op.op === "run-tool-stages") {
      assert.ok(!["author", "audit", "merge", "done"].includes(state.stage) && op.command === "l2 run --until ci", label);
    } else assert.ok(["reconcile", "recover-journal"].includes(op.op), `unexpected driver operation ${label}`);
  }
}

test("every operation a driver is offered is one the state machine accepts now", () => {
  const both = { submitted: [{ role: "first-audit", auditor: "A" }, { role: "first-audit", auditor: "B" }], outcome: "record" as const };
  const drafted = rec(rec(runOf([G1, G2], V2), "author", "a"), "author", "b");
  const audited = rec(rec(drafted, "audit", "a"), "audit", "b");
  let finished = rec(rec(rec(rec(rec(audited, "group-audit", "g1"), "author", "s"), "author", "t"), "audit", "s"), "audit", "t");
  finished = rec(finished, "group-audit", "g2");
  const fresh = createL2RunState({ slice: sliceOf([G1, G2]), remaining: ["a", "b", "s", "t"], branch: "b", baseSha: "base", now: T0, pipeline: V2 });
  const scenarios: [string, RunState, Partial<L2NextInput>][] = [
    ["plans to write", fresh, {}],
    ["a plan to record", fresh, { plans: { g1: true } }],
    ["drafting", runOf([G1, G2], V2), {}],
    ["a draft to record", runOf([G1, G2], V2), { drafts: { a: true }, attempts: [attempt("att-1", { kind: "author", subject: "a", role: "author" }, "running")] }],
    ["first audits", drafted, { audits: { "audit:a": both, "audit:b": { submitted: [], outcome: "missing" } } }],
    ["blocking findings", drafted, { audits: { "audit:a": { ...both, outcome: "blocking", concepts: ["a"] } } }],
    ["the group audit", audited, { audits: { "group-audit:g1": { submitted: [{ role: "group-audit", auditor: "G" }], outcome: "record" } } }],
    ["the audit stage", finished, {}],
    ["validation", { ...finished, stage: "gates" }, {}],
    ["legacy designs", runOf([G1]), { tracked: false, designs: { a: true } }],
    ["v1 drafting", runOf([G1], V1), { tracked: false, drafts: { a: true } }],
  ];
  for (const [name, state, over] of scenarios) {
    const view = l2Next(input(state, over));
    assert.ok(view.permitted.length > 0 || view.attended.length > 0, `${name}: something is offered`);
    assertExecutable(view, state, over.attempts ?? []);
  }
  // The audit stage completes only at stage audit with nothing stale; a draft whose attempt's inputs changed is not recorded.
  assert.deepEqual(l2Next(input(finished)).operations.map((op) => op.op), ["complete-audit"]);
  const changed = l2Next(input(runOf([G1, G2], V2), { drafts: { a: true }, attempts: [attempt("att-1", { kind: "author", subject: "a", role: "author" }, "running")], inputsCurrent: { "att-1": false } }));
  assert.deepEqual([stepOf(changed, "author:a")?.status, changed.permitted, changed.attended, codes(changed)], ["blocked", ["reconcile"], [], ["attempt-inputs-changed att-1"]]);
  // A pending attempt for older inputs is reconciled (which fails it), never launched.
  const olderPending = l2Next(input(runOf([G1, G2], V2), { attempts: [attempt("att-1", { kind: "author", subject: "a", role: "author" }, "pending")], inputsCurrent: { "att-1": false } }));
  assert.deepEqual([stepOf(olderPending, "author:a")?.status, olderPending.attended, olderPending.permitted], ["waiting", [], ["reconcile"]]);
});

test("a neighbour-stale audit is re-audited only where its audit may still be replaced; otherwise it is reopened", () => {
  const audited = rec(rec(rec(rec(runOf([G1], V2), "author", "a"), "author", "b"), "audit", "a"), "audit", "b");
  const neighbourOnly = { drafts: {}, audits: { a: { record: { bound: "A", current: "A" }, neighbours: { bound: { n: "N1" }, current: { n: "N2" } } } }, groupAudits: {} };
  const resolutionAt = (state: RunState) => l2Next(input(state, { freshness: neighbourOnly })).freshness.stale[0];
  const replace = (state: RunState) => () => recordL2Step(state, { kind: "audit", subject: "a" }, T0);
  // While drafting or auditing, and while validating before the first commit: the audit is replaced.
  for (const state of [audited, { ...audited, stage: "gates" as const }]) {
    assert.deepEqual([resolutionAt(state).resolution, resolutionAt(state).actor], ["re-audit", "attended"]);
    assert.doesNotThrow(replace(state));
  }
  // After the run's commits (the old advice): recording a replacement is refused, so it is reopened by a human.
  const committed: RunState = { ...audited, stage: "gates", commits: [{ sha: "c1", message: "m", files: [] }] };
  assert.throws(replace(committed), (error: unknown) => error instanceof RunStateError && /once the run has commits/.test(error.message));
  assert.deepEqual([resolutionAt(committed).resolution, resolutionAt(committed).actor, resolutionAt(committed).command], ["reopen", "human", 'l2 reopen a --reason ".."']);
  assert.doesNotThrow(() => reopenL2(committed, { concepts: ["a"], reason: "neighbour changed", baseline: { work: {}, members: {}, splits: {} } as never, now: T0 }));
  assert.equal(l2Next(input(committed, { freshness: neighbourOnly })).state, "blocked");
  // Past the stages that record audits (pushed, in a PR): the same.
  const pushed: RunState = { ...committed, stage: "pr" };
  assert.throws(replace(pushed));
  assert.equal(resolutionAt(pushed).resolution, "reopen");
  // Merging: nothing in this run changes it; a human repairs it in a new run once merged.
  const merging: RunState = { ...committed, stage: "merge" };
  assert.throws(() => reopenL2(merging, { concepts: ["a"], reason: "r", baseline: {} as never, now: T0 }));
  assert.deepEqual([resolutionAt(merging).resolution, resolutionAt(merging).command], ["repair-run", 'l2 start --slice d-1 --repair a --reason ".." (once the PR is merged)']);
  // An open repair before it in recording order: re-audited once that is recorded.
  const repairing = reopenL2(audited, { concepts: ["b"], reason: "fix", baseline: { work: {}, members: {}, splits: {} } as never, now: T0 });
  const waiting = l2Next(input(repairing, { freshness: neighbourOnly })).freshness.stale[0];
  assert.deepEqual([waiting.resolution, waiting.after], ["re-audit", "author:b"]);
  assert.deepEqual(auditReplacement(repairing, "audit:a"), { now: false, after: "author:b" });
  assert.throws(replace(repairing), /record author:b first/);
  // A group audit is replaced only while the run drafts or audits.
  assert.deepEqual([auditReplacement(rec(audited, "group-audit", "g1"), "group-audit:g1").now, auditReplacement({ ...rec(audited, "group-audit", "g1"), stage: "gates" }, "group-audit:g1").now], [true, false]);
});

test("the batch limit: a new group-batched run holds at most 12 concepts; legacy, v1 and existing runs are unchanged", () => {
  const many = (n: number) => Array.from({ length: n }, (_, index) => `c${index}`);
  const start = (n: number, pipeline?: L2Pipeline) => () => createL2RunState({ slice: sliceOf([{ group: "g", concepts: many(n) }]), remaining: many(n), branch: "b", baseSha: "base", now: T0, ...(pipeline ? { pipeline } : {}) });
  assert.throws(start(13, V2), /at most 12 concepts.*would hold 13/);
  assert.deepEqual(start(12, V2)().l2?.batch, { maxConcepts: 12 });
  assert.doesNotThrow(start(13, V1));
  assert.doesNotThrow(start(13));
  assert.equal(batchStartProblem(V1, 40, "x"), undefined);
  assert.match(batchStartProblem(V2, 13, "l2 batches --slice s") ?? "", /l2 batches --slice s/);
  // A run started under the limit whose state no longer satisfies it begins no attempt (the CLI's attempt boundary).
  const run = start(12, V2)();
  assert.equal(batchLimitProblem(run), undefined);
  const edited: RunState = { ...run, l2: { ...run.l2!, slice: { ...run.l2!.slice, groups: [{ group: "g", title: "g", concepts: many(13) }] } } };
  assert.match(batchLimitProblem(edited) ?? "", /batch limit of 12 concepts but holds 13/);
  // A run started before the limit existed (no marker) keeps its semantics.
  const { batch: _batch, ...older } = edited.l2!;
  void _batch;
  assert.equal(batchLimitProblem({ ...edited, l2: older }), undefined);
});

test("authority: a driver is offered only deterministic, unpaid operations; paid work is attended; judgments are a human's", () => {
  const drafted = rec(rec(runOf([G1], V2), "author", "a"), "author", "b");
  const views = [
    l2Next(input(runOf([G1], V2))),
    l2Next(input(drafted, { attempts: [attempt("p", { kind: "audit", subject: "a", role: "first-audit", auditor: "A" }, "pending"), attempt("i", { kind: "audit", subject: "b", role: "first-audit", auditor: "A" }, "interrupted")] })),
    l2Next(input(createL2RunState({ slice: sliceOf([G1]), remaining: ["a", "b"], branch: "b", baseSha: "base", now: T0, pipeline: V2 }))),
    l2Next(input(runOf([G1]), { tracked: false })),
  ];
  const human = /merge|release|decide|resume|checkpoint|budget|authorize|fail|interrupt/;
  for (const view of views) {
    const ops = view.steps.flatMap((step) => step.operations ?? []);
    for (const op of ops) assert.equal(op.paid, op.actor === "attended", `${op.op} is paid exactly when it is attended`);
    assert.deepEqual(view.permitted, [...new Set([...ops.filter((op) => op.actor === "driver"), ...view.operations].map((op) => op.op))].sort());
    assert.ok(view.attended.every((name) => ["launch-agent", "run-agent", "author-plan", "author-design"].includes(name)));
    assert.ok([...view.permitted, ...view.attended].every((name) => !human.test(name)));
    // A tracked run is never offered an untracked launch.
    if (view.run.tracksAttempts) assert.ok(!ops.some((op) => op.op === "run-agent"));
    for (const blocker of view.blockers.filter((entry) => entry.actor === "human")) assert.ok(!ops.some((op) => op.command === blocker.command));
  }
  assert.deepEqual(views[1].attended, ["launch-agent"]);
  assert.ok(views[1].blockers.some((blocker) => blocker.code === "attempt-interrupted" && blocker.actor === "human"));
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
