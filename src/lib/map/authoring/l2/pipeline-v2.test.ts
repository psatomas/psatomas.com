import assert from "node:assert/strict";
import test from "node:test";
import type { MapConceptContent } from "../../types.ts";
import { auditNeed, completeStage, createL2RunState, mayMerge, nextAction, pendingDrafts, pendingL2Steps, recordL2Step, reopenL2, STAGES, type RunState } from "../orchestrator/run-state.ts";
import { pilotSlice, sliceSteps, stepKey } from "./campaign.ts";
import { expandedNeighbours, MAX_REFERENCED_NEIGHBOURS, neighbourBasis } from "./coverage.ts";
import { assembleL2Context } from "./context.ts";
import { filledG1, model, options, REGISTRY } from "./fixtures.ts";
import { isBatched, pipelineMismatchProblem, pipelineSpec, samePipeline, startPipeline, type L2Pipeline } from "./pipeline.ts";
import type { L2GroupFile } from "./territory.ts";

const T0 = "2026-11-02T00:00:00.000Z";
const V1: L2Pipeline = { mode: "simplified", version: 1 };
const V2: L2Pipeline = { mode: "simplified", version: 2 };
const GROUPS = [
  { group: "g1", concepts: ["a", "b"] },
  { group: "g2", concepts: ["s", "t"] },
];

test("legacy and simplified v1 keep their original step order; v2 is group-batched", () => {
  const v1 = ["plan:g1", "plan:g2", "author:a", "audit:a", "author:b", "audit:b", "author:s", "audit:s", "author:t", "audit:t", "group-audit:g1", "group-audit:g2"];
  assert.deepEqual(sliceSteps(GROUPS, "simplified").map(stepKey), v1);
  assert.deepEqual(sliceSteps(GROUPS, "simplified", 1).map(stepKey), v1);
  assert.deepEqual(sliceSteps(GROUPS).map(stepKey), ["plan:g1", "plan:g2", "design:a", "design:b", "design:s", "design:t", ...v1.slice(2)]);
  // v2: every plan; then each group drafts all, audits all, and is audited, before the next group starts.
  assert.deepEqual(sliceSteps(GROUPS, "simplified", 2).map(stepKey), ["plan:g1", "plan:g2", "author:a", "author:b", "audit:a", "audit:b", "group-audit:g1", "author:s", "author:t", "audit:s", "audit:t", "group-audit:g2"]);
  assert.deepEqual([isBatched(V1), isBatched(V2), isBatched({ mode: "legacy", version: 1 }), isBatched(undefined)], [false, true, false, false]);
});

/** A run of g1 (a, b) under `pipeline`, its plan recorded. */
function run(pipeline: L2Pipeline): RunState {
  const state = createL2RunState({ slice: pilotSlice(model(), ["g1"], REGISTRY), remaining: ["a", "b"], branch: "feat/map-x-l2-1", baseSha: "base", now: T0, pipeline });
  return recordL2Step(state, { kind: "plan", subject: "g1" }, T0);
}
const record = (state: RunState, kind: "author" | "audit" | "group-audit", subject: string) => recordL2Step(state, { kind, subject }, T0, kind === "group-audit" ? {} : { fingerprint: `${subject}-v1` });

test("v2 refuses any first audit of a group before every draft of that group is recorded", () => {
  let state = record(run(V2), "author", "a");
  assert.throws(() => record(state, "audit", "a"), /record author:b first/);
  assert.equal(nextAction(state).kind, "agent");
  // A v2 run started now tracks attempts: the draft is begun as an attempt, then recorded with it.
  assert.match((nextAction(state) as { message: string }).message, /^first `map:author -- l2 attempt begin author b --role author`.*author b in a fresh context.*record author b --attempt <id>/);
  state = record(state, "author", "b");
  // With every draft in place, the first audits may be recorded, in order.
  assert.match((nextAction(state) as { message: string }).message, /first audits of a: two independent auditors, A and B, each in its own fresh context.*audit-task a --role first-audit --auditor A`.*--auditor B`/);
  state = record(record(state, "audit", "a"), "audit", "b");
  state = record(state, "group-audit", "g1");
  assert.deepEqual(pendingL2Steps(state), []);
});

test("v1 keeps drafting and auditing each concept in turn, and stays resumable from its persisted state", () => {
  let state = record(run(V1), "author", "a");
  assert.throws(() => record(state, "author", "b"), /record audit:a first/);
  state = record(state, "audit", "a");
  const persisted: RunState = JSON.parse(JSON.stringify(state));
  assert.deepEqual(pendingL2Steps(persisted).map(stepKey), ["author:b", "audit:b", "group-audit:g1"]);
  // Its messages keep the v1 audit contract, and ask for v1 group files.
  assert.match((nextAction(record(persisted, "author", "b")) as { message: string }).message, /record audit b --audit-file <json>/);
  const fresh = createL2RunState({ slice: pilotSlice(model(), ["g1"], REGISTRY), remaining: ["a", "b"], branch: "feat/map-x-l2-1", baseSha: "base", now: T0, pipeline: V1 });
  assert.match((nextAction(fresh) as { message: string }).message, /--write --pipeline simplified@1/);
  assert.equal(pipelineSpec(V1), "simplified@1");
});

test("v2 audits each group as it finishes, while later groups are still being drafted", () => {
  let state = createL2RunState({ slice: pilotSlice(model(), ["g1", "g2"], REGISTRY), remaining: ["a", "b", "s", "t"], branch: "feat/map-x-l2-1", baseSha: "base", now: T0, pipeline: V2 });
  for (const group of ["g1", "g2"]) state = recordL2Step(state, { kind: "plan", subject: group }, T0);
  for (const step of [["author", "a"], ["author", "b"], ["audit", "a"], ["audit", "b"]] as const) state = record(state, step[0], step[1]);
  assert.equal(state.stage, "author");
  state = record(state, "group-audit", "g1");
  assert.deepEqual(pendingL2Steps(state).map(stepKey).slice(0, 2), ["author:s", "author:t"]);
});

test("human merge approval stays mandatory under v2: a run without an authorization ends at a validated PR", () => {
  let state = record(record(record(record(run(V2), "author", "a"), "author", "b"), "audit", "a"), "audit", "b");
  state = record(state, "group-audit", "g1");
  for (const stage of STAGES.slice(STAGES.indexOf("audit"), STAGES.indexOf("ci") + 1)) state = completeStage(state, stage, T0, stage === "audit" ? "audited" : undefined);
  assert.equal(mayMerge(state), false);
  assert.equal(state.stage, "done");
  assert.equal(state.completed.merge?.detail, "awaiting human merge");
});

test("a group file of another pipeline version is refused for the run, in either direction", () => {
  assert.equal(samePipeline(V1, V2), false);
  assert.match(pipelineMismatchProblem("g1", "groups/g1.json", V1, startPipeline("simplified"))!, /declares the simplified pipeline v1 but the run uses the simplified pipeline v2: set "pipeline": \{"mode":"simplified","version":2\}/);
  assert.match(pipelineMismatchProblem("g1", "groups/g1.json", V2, startPipeline("simplified@1"))!, /declares the simplified pipeline v2 but the run uses the simplified pipeline v1/);
  assert.equal(pipelineMismatchProblem("g1", "groups/g1.json", V2, startPipeline("simplified")), undefined);
});

test("reopening snapshots each concept's record as its failing audit judged it; a v1 caller without snapshots is unchanged", () => {
  let state = record(record(record(record(run(V2), "author", "a"), "author", "b"), "audit", "a"), "audit", "b");
  const before: MapConceptContent = { id: "a-content", conceptId: "a", definition: "Alpha starts.", body: [] };
  const baseline = { work: {}, members: {}, splits: {} };
  state = reopenL2(state, { concepts: ["a"], reason: "B1", baseline, now: T0, records: { a: before } });
  assert.deepEqual(state.l2!.repair!.records, { a: before });
  // Reopened again in the same cycle after a failed re-audit: the newer record is what the next repair answers.
  state = record(state, "author", "a");
  const second = { ...before, definition: "Alpha starts a sequence." };
  state = reopenL2(state, { concepts: ["a"], reason: "R1", baseline, now: T0, records: { a: second } });
  assert.deepEqual(state.l2!.repair!.records, { a: second });
  const v1 = reopenL2(record(record(run(V1), "author", "a"), "audit", "a"), { concepts: ["a"], reason: "B1", baseline, now: T0 });
  assert.equal("records" in v1.l2!.repair!, false);
});

/** The fixture world plus concepts outside a's group and hazards: v (excluded by a) and w (named in a's record), both authored. */
function wider(plan: (m: ReturnType<typeof model>) => L2GroupFile) {
  const a: MapConceptContent = { id: "a-content", conceptId: "a", definition: "Alpha is how a sequence starts.", body: [{ kind: "paragraph", text: "A start differs from a Whisker Wheel, and Group One frames it." }] };
  const base = model([a, { id: "v-content", conceptId: "v", definition: "Velocity is a rate." }, { id: "w-content", conceptId: "w", definition: "A Whisker Wheel turns." }]);
  const m = {
    ...base,
    concepts: [...base.concepts, { id: "v", slug: "v", title: "Velocity" }, { id: "w", slug: "w", title: "Whisker Wheel" }],
    placements: [...base.placements, { id: "v", conceptId: "v", parentPlacementId: "g2", order: 9 }, { id: "w", conceptId: "w", parentPlacementId: "g2", order: 10 }],
  };
  const groupFile = plan(m);
  groupFile.members.find((member) => member.conceptId === "a")!.excludes = ["v"];
  return { m, groupFile };
}

test("v2 neighbours add the member's exclusions and the authored concepts its record names, never its ancestors; v1 neighbours are unchanged", () => {
  const registry = { ...options, registry: [...REGISTRY, "a", "v", "w"] };
  const v2 = wider((m) => ({ ...filledG1(m), pipeline: V2 }));
  const neighbours = Object.keys(neighbourBasis(v2.m, [v2.groupFile], "a", registry));
  assert.ok(neighbours.includes("v"), `excluded v: ${neighbours}`);
  assert.ok(neighbours.includes("w"), `named w: ${neighbours}`);
  // The record names Group One, its parent: a premise judged by parent overlap, not a neighbour.
  assert.ok(!neighbours.includes("g1"));
  const v1 = wider((m) => ({ ...filledG1(m), pipeline: V1 }));
  const old = Object.keys(neighbourBasis(v1.m, [v1.groupFile], "a", registry));
  assert.ok(!old.includes("v") && !old.includes("w"), `v1: ${old}`);
  // Deterministic: the same inputs give the same list.
  assert.deepEqual(Object.keys(neighbourBasis(v2.m, [v2.groupFile], "a", registry)), neighbours);
});

test("the named concepts a record adds are bounded and chosen in id order", () => {
  const titles = Array.from({ length: MAX_REFERENCED_NEIGHBOURS + 5 }, (_, index) => ({ id: `n${String(index).padStart(2, "0")}`, title: `Named Thing ${String.fromCharCode(65 + index)}` }));
  const a: MapConceptContent = { id: "a-content", conceptId: "a", definition: "Alpha is how a sequence starts.", body: [{ kind: "paragraph", text: titles.map((entry) => entry.title).join(", ") }] };
  const base = model([a, ...titles.map((entry) => ({ id: `${entry.id}-content`, conceptId: entry.id, definition: `${entry.title} exists.` }))]);
  const m = {
    ...base,
    concepts: [...base.concepts, ...titles.map((entry) => ({ id: entry.id, slug: entry.id, title: entry.title }))],
    placements: [...base.placements, ...titles.map((entry, index) => ({ id: entry.id, conceptId: entry.id, parentPlacementId: "g2", order: 20 + index }))],
  };
  const plan = { ...filledG1(m), pipeline: V2 };
  const added = expandedNeighbours(m, "a", assembleL2Context("a", m, [plan], options));
  assert.equal(added.length, MAX_REFERENCED_NEIGHBOURS);
  assert.deepEqual(added, titles.slice(0, MAX_REFERENCED_NEIGHBOURS).map((entry) => entry.id));
});

test("an audit artifact is accepted only once every draft of its group exists, and the audit asked for follows the concept's repairs", () => {
  let state = record(run(V2), "author", "a");
  assert.deepEqual(pendingDrafts(state, "g1"), ["b"]);
  state = record(state, "author", "b");
  assert.deepEqual(pendingDrafts(state, "g1"), []);
  // A concept its design blocks is never drafted, and never holds the group's audits back.
  assert.deepEqual(pendingDrafts({ ...run(V2), l2: { ...run(V2).l2!, blocked: ["a", "b"] } }, "g1"), []);
  assert.throws(() => pendingDrafts(state, "g9"), /not a group of slice/);
  assert.deepEqual([auditNeed(state, "audit", "a"), auditNeed(state, "group-audit", "g1")], ["first-audit", "group-audit"]);
  const reopened = reopenL2(record(record(state, "audit", "a"), "audit", "b"), { concepts: ["a"], reason: "B1", baseline: { work: {}, members: {}, splits: {} }, now: T0 });
  // Once repaired, a concept needs an independent re-audit; the other keeps needing nothing new.
  assert.deepEqual([auditNeed(reopened, "audit", "a"), auditNeed(reopened, "audit", "b")], ["re-audit", "first-audit"]);
});

test("each concept's repair evidence stays its own across the cycle's reopenings, and the repair step names only its own", () => {
  let state = record(record(record(record(run(V2), "author", "a"), "author", "b"), "audit", "a"), "audit", "b");
  const baseline = { work: {}, members: {}, splits: {} };
  const finding = (concept: string, action: string) => ({ severity: "blocking" as const, concept, evidence: { quote: "q" }, action, auditor: "A", role: "first-audit" as const, artifact: { path: `${concept}/k/first-audit-A-001.json`, key: "k", sha256: "s" } });
  state = reopenL2(state, { concepts: ["a"], reason: "a: fix A1", baseline, now: T0, evidence: { a: { at: T0, findings: [finding("a", "fix A1")] } } });
  state = reopenL2(state, { concepts: ["b"], reason: "b: fix B1", baseline, now: T0, evidence: { b: { at: T0, findings: [finding("b", "fix B1")] } } });
  assert.deepEqual(Object.keys(state.l2!.repair!.evidence!).sort(), ["a", "b"]);
  // The cycle's latest reopening is b's; a's repair step still names a's own findings, never b's.
  const message = (nextAction(state) as { message: string }).message;
  assert.match(message, /repair a \(cycle 1: its own findings: `map:author -- l2 repair-findings a`\)/);
  assert.ok(!message.includes("fix B1"));
  // Reopened again after a failed re-audit: a's findings accumulate, so its next re-audit verifies every one.
  state = record(state, "author", "a");
  state = reopenL2(state, { concepts: ["a"], reason: "a: fix R1", baseline, now: T0, evidence: { a: { at: T0, findings: [finding("a", "fix R1")] } } });
  assert.deepEqual(state.l2!.repair!.evidence!.a.map((entry) => entry.findings[0].action), ["fix A1", "fix R1"]);
  assert.deepEqual(state.l2!.repair!.evidence!.b.map((entry) => entry.findings[0].action), ["fix B1"]);
  // A cycle opened without evidence (before it was kept, or a v1 run) keeps its old message and shape.
  const old = reopenL2(record(record(record(record(run(V2), "author", "a"), "author", "b"), "audit", "a"), "audit", "b"), { concepts: ["a"], reason: "B1", baseline, now: T0 });
  assert.equal("evidence" in old.l2!.repair!, false);
  assert.match((nextAction(old) as { message: string }).message, /repair a \(cycle 1: B1\)/);
});
