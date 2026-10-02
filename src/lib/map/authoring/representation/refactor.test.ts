import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { mapKnowledge } from "../../data.ts";
import type { MapConceptContent, MapContentBlock, MapKnowledgeModel } from "../../types.ts";
import { orchestratorModel, registryOf } from "../orchestrator/fixtures.ts";
import { refactorCommitMessage } from "../orchestrator/report.ts";
import {
  commitGroups,
  compositionProblems,
  createRefactorRunState,
  gitProblems,
  invalidate,
  nextAction,
  prMismatch,
  recordDecision,
  startProblems,
  completeStage,
  type ObservedStart,
  type RunState,
} from "../orchestrator/run-state.ts";
import { contentFingerprint, emptyStore, placementsOf, recordDesign } from "./design.ts";
import {
  ACCEPTED_DESIGNS_FILE,
  decisionProblems,
  designSetFingerprint,
  exportAcceptedDesigns,
  MAP_RUN_BRANCH,
  planRefactor,
  refactorBranch,
  refactorCampaign,
  resolveSpec,
  reviewBlockedDesign,
  specDiffProblems,
  specProblems,
  type AcceptedDesign,
  type AcceptedDesignSpec,
  type Decision,
} from "./refactor.ts";
import { validateRefactorDiff } from "./refactor-diff.ts";

/**
 * The orchestrator's synthetic ontology with L1 content: single (Domain One,
 * one placement), c (two child-carrying placements, owned by Domain Two under
 * the facet rule) and t (carried in Domain Two, a leaf in Domain One), plus
 * done (Domain One) and k (Domain Three), which no design lists: KEEP.
 */
function model(): MapKnowledgeModel {
  const base = orchestratorModel({ authored: ["single", "c", "t"] });
  const bodies: Record<string, MapConceptContent["body"]> = {
    single: [{ kind: "paragraph", text: "Single explained." }],
    c: [{ kind: "paragraph", text: "Concept explained." }, { kind: "distinction", left: "Concept", right: "Kilo" }],
    t: [{ kind: "paragraph", text: "Transit explained." }],
  };
  return { ...base, content: base.content.map((record) => (bodies[record.conceptId] ? { ...record, body: bodies[record.conceptId] } : record)) };
}
const recordOf = (m: MapKnowledgeModel, conceptId: string) => m.content.find((record) => record.conceptId === conceptId)!;
const withRecord = (m: MapKnowledgeModel, conceptId: string, change: Partial<MapConceptContent>) => ({
  ...m,
  content: m.content.map((record) => (record.conceptId === conceptId ? { ...record, ...change } : record)),
});
const CYCLE: MapContentBlock = { kind: "cycle", label: "Loop", steps: ["A", "B", "C"] };
const COMPARISON: MapContentBlock = { kind: "comparison", label: "Options", dimensions: ["Cost", "Trust"], alternatives: [{ name: "One", values: ["Low", "High"] }, { name: "Two", values: ["High", "Low"] }] };

function design(m: MapKnowledgeModel, conceptId: string, overrides: Partial<AcceptedDesign> = {}): AcceptedDesign {
  const facts = placementsOf(m, conceptId);
  return {
    conceptId,
    domainId: facts.ownerDomainId,
    classification: "refactor",
    status: "actionable",
    model: { purpose: "synthetic" },
    current: { sequence: "def+P", structured: [] },
    target: [{ structure: "prose", purpose: "argument" }, { structure: "cycle", purpose: "the loop" }],
    justification: "the loop is the meaning",
    placements: facts.placements.map((placement) => placement.placementId),
    sourceFingerprint: contentFingerprint(recordOf(m, conceptId)),
    ...overrides,
  };
}
/** single: refactor to a cycle; t: enhance with a comparison; c: blocked on state. */
function spec(m: MapKnowledgeModel): AcceptedDesignSpec {
  return {
    version: 1,
    designs: [
      design(m, "single"),
      design(m, "t", { classification: "enhance", target: [{ structure: "prose", purpose: "argument" }, { structure: "comparison", purpose: "options by cost and trust" }], canonicalNote: "holds as a leaf in Domain One" }),
      design(m, "c", { status: "blocked", blockedBy: ["state"], target: [{ structure: "prose", purpose: "argument" }, { structure: "state", purpose: "returns" }], facetNote: "relates both layers" }),
    ],
  };
}

test("the accepted-design spec is checked as governance: shape, ownership, gaps and freshness", () => {
  const m = model();
  assert.deepEqual(specProblems(spec(m), m), []);
  const s = spec(m);
  const broken: AcceptedDesignSpec = {
    version: 1,
    designs: [
      { ...s.designs[0], domainId: "d3" },
      s.designs[0],
      { ...s.designs[1], status: "blocked" as const },
      { ...design(m, "k"), target: [{ structure: "state" as const, purpose: "x" }] },
      { ...design(m, "done"), sourceFingerprint: "reviewed-something-else" },
      { ...design(m, "a" as never) },
    ].filter((entry) => entry.conceptId !== "a"),
  };
  const problems = specProblems(broken, m).join("\n");
  for (const expected of [/single: owned by d1, listed under d3/, /single: listed twice/, /t: blocked without a missing primitive/, /k: actionable but needs state/, /done: the record changed since its design was accepted/]) {
    assert.match(problems, expected);
  }
  const keptDifferently = { version: 1 as const, designs: [{ ...s.designs[0], resolution: { decision: "keep" as Decision, structured: [], resultFingerprint: "other", note: "x" } }] };
  assert.match(specProblems(keptDifferently, m).join(), /kept, yet resolved to different content/);
});

test("the spec is exported from an audit's designs: improvements only, blocked where a primitive is missing, every placement listed", () => {
  const m = model();
  const facts = (conceptId: string) => placementsOf(m, conceptId);
  const base = { model: { purpose: "p", context: "scratch context is not persisted" }, reasoning: "r" };
  let d1 = emptyStore("d1");
  d1 = recordDesign(d1, { conceptId: "single", classification: "enhance", representation: [{ structure: "prose", purpose: "x" }, { structure: "cycle", purpose: "loop" }], ...base }, recordOf(m, "single"), facts("single"), "now");
  d1 = recordDesign(d1, { conceptId: "done", classification: "keep", representation: [{ structure: "prose", purpose: "x" }], ...base }, recordOf(m, "done"), facts("done"), "now");
  let d2 = emptyStore("d2");
  d2 = recordDesign(d2, { conceptId: "c", classification: "refactor", representation: [{ structure: "prose", purpose: "x" }, { structure: "state", purpose: "returns" }], canonicalNote: "both", facetNote: "both layers", ...base }, recordOf(m, "c"), facts("c"), "now");
  d2 = recordDesign(d2, { conceptId: "t", classification: "enhance", representation: [{ structure: "prose", purpose: "x" }, { structure: "comparison", purpose: "options" }], canonicalNote: "leaf too", ...base }, recordOf(m, "t"), facts("t"), "now");
  const exported = exportAcceptedDesigns([d2, d1], m);
  assert.deepEqual(exported.designs.map((entry) => [entry.conceptId, entry.status, entry.domainId]), [["single", "actionable", "d1"], ["c", "blocked", "d2"], ["t", "actionable", "d2"]]);
  assert.equal("context" in exported.designs[0].model, false);
  assert.deepEqual(exported.designs[1].placements, ["c-in-d2", "c"]);
  assert.deepEqual(exported.designs[2].placements.sort(), ["t", "t-in-d1"]);
  assert.deepEqual(specProblems(exported, m), []);
});

test("a domain's plan separates actionable, blocked, resolved and KEEP; the campaign skips domains without work", () => {
  const m = model();
  const d1 = planRefactor(spec(m), m, "d1");
  // t and c are placed in Domain One but designed under Domain Two: protected here like done.
  assert.deepEqual([d1.actionable.map((entry) => entry.conceptId), d1.keep, d1.noop, d1.complete], [["single"], ["c", "done", "t"], false, false]);
  const d2 = planRefactor(spec(m), m, "d2");
  assert.deepEqual([d2.actionable.map((entry) => entry.conceptId), d2.blocked.map((entry) => entry.conceptId)], [["t"], ["c"]]);
  assert.equal(planRefactor(spec(m), m, "d3").noop, true);
  const campaign = refactorCampaign(spec(m), m);
  assert.deepEqual(campaign.domains.map((domain) => [domain.domainId, domain.state]), [["d1", "pending"], ["d2", "pending"], ["d3", "no work"]]);
  assert.equal(campaign.next, "d1");
  // Resolving Domain One's design completes it; a blocked design never holds a domain open.
  const resolved = resolveSpec(spec(m), { single: { decision: "keep", note: "prose suffices" } }, m);
  const after = refactorCampaign(resolved, m);
  assert.deepEqual(after.domains.map((domain) => domain.state), ["complete", "pending", "no work"]);
  assert.equal(after.next, "d2");
  const allDone = resolveSpec(resolved, { t: { decision: "keep", note: "x" } }, m);
  assert.equal(refactorCampaign(allDone, m).next, undefined);
  // A record changed since its design was accepted makes the plan stale.
  const edited = withRecord(m, "single", { body: [{ kind: "paragraph", text: "Edited elsewhere." }] });
  assert.deepEqual(planRefactor(spec(m), edited, "d1").stale, ["single"]);
  assert.equal(refactorCampaign(spec(m), edited).domains[0].state, "stale");
});

test("a blocked design is re-reviewed outside a run, and only as keep", () => {
  const m = model();
  const reviewed = reviewBlockedDesign(spec(m), m, "c", "the state machine belongs to a child");
  assert.deepEqual(reviewed.problems, []);
  assert.deepEqual(reviewed.spec!.designs[2].resolution, { decision: "keep", structured: ["distinction"], resultFingerprint: spec(m).designs[2].sourceFingerprint, note: "the state machine belongs to a child" });
  assert.deepEqual(specProblems(reviewed.spec!, m), []);
  assert.deepEqual(specDiffProblems(spec(m), reviewed.spec!, ["c"]), []);
  const d2 = planRefactor(reviewed.spec!, m, "d2");
  assert.deepEqual([d2.blocked, d2.resolved.map((entry) => entry.conceptId), d2.actionable.map((entry) => entry.conceptId)], [[], ["c"], ["t"]]);
  assert.match(reviewBlockedDesign(spec(m), m, "single", "x").problems.join(), /not blocked; an actionable design is resolved by a refactor run/);
  assert.match(reviewBlockedDesign(reviewed.spec!, m, "c", "x").problems.join(), /already resolved \(keep\)/);
  assert.match(reviewBlockedDesign(spec(m), m, "c", " ").problems.join(), /needs a note/);
  assert.match(reviewBlockedDesign(spec(m), withRecord(m, "c", { body: [{ kind: "paragraph", text: "Edited elsewhere." }] }), "c", "x").problems.join(), /record changed since its design was accepted/);
  const executed = { ...spec(m), designs: spec(m).designs.map((entry) => (entry.conceptId === "c" ? { ...entry, resolution: { decision: "execute" as Decision, structured: [], resultFingerprint: entry.sourceFingerprint, note: "x" } } : entry)) };
  assert.match(specProblems(executed, m).join(), /c: a blocked design can only be resolved as keep, by re-review/);
});

test("the execution boundary: execute, reduce or keep within the accepted design, and nothing else", () => {
  const m = model();
  const single = spec(m).designs[0];
  const base = recordOf(m, "single");
  const withCycle = { ...base, body: [...base.body!, CYCLE] };
  assert.deepEqual(decisionProblems(single, base, withCycle, "execute"), []);
  assert.deepEqual(decisionProblems(single, base, base, "keep"), []);
  // A smaller change: prose reorganized without the cycle.
  assert.deepEqual(decisionProblems(single, base, { ...base, body: [{ kind: "paragraph", text: "Single, reorganized." }] }, "reduce"), []);
  assert.match(decisionProblems(single, base, { ...base, body: [{ kind: "paragraph", text: "Single, reorganized." }] }, "execute").join(), /execute must reach the accepted structured form \(cycle\)/);
  assert.match(decisionProblems(single, base, withCycle, "keep").join(), /kept, so the record must stay exactly as reviewed/);
  assert.match(decisionProblems(single, base, base, "execute").join(), /record keep instead/);
  // Substitution: a comparison where a cycle was accepted.
  assert.match(decisionProblems(single, base, { ...base, body: [...base.body!, COMPARISON] }, "reduce").join(), /uses comparison, which the accepted design does not include/);
  // Escalation: a refactor that rewrites the definition.
  assert.match(decisionProblems(single, base, { ...withCycle, definition: "A new definition." }, "execute").join(), /definition changed; a refactor keeps it/);
  assert.deepEqual(decisionProblems({ ...single, classification: "rewrite" }, base, { ...withCycle, definition: "A new definition." }, "execute"), []);
  // Blocked designs and designs reviewed against other content cannot be executed.
  const c = spec(m).designs[2];
  assert.match(decisionProblems(c, recordOf(m, "c"), recordOf(m, "c"), "keep").join(), /blocked by state/);
  assert.match(decisionProblems(single, { ...base, definition: "Other." }, withCycle, "execute").join(), /not the one the design reviewed/);
});

test("ENHANCE on a multi-placement concept: a structure is added, and every placement is accounted for", () => {
  const m = model();
  const t = spec(m).designs[1];
  const base = recordOf(m, "t");
  assert.deepEqual(decisionProblems(t, base, { ...base, body: [...base.body!, COMPARISON] }, "execute"), []);
  assert.deepEqual(t.placements.sort(), ["t", "t-in-d1"]);
});

/** Base and head for a Domain One run in which single is executed as a cycle. */
function runDiff(change: (head: MapKnowledgeModel) => MapKnowledgeModel = (head) => head, decisions: Record<string, Decision> = { single: "execute" }) {
  const base = model();
  const baseSpec = spec(base);
  const executed = withRecord(base, "single", { body: [...recordOf(base, "single").body!, CYCLE] });
  const head = change(executed);
  const notes = Object.fromEntries(Object.entries(decisions).map(([conceptId, decision]) => [conceptId, { decision, note: "reconsidered" }]));
  return {
    base,
    head,
    baseRegistry: registryOf(base),
    headRegistry: registryOf(head),
    baseView: { roots: [] },
    headView: { roots: [] },
    baseSpec,
    headSpec: resolveSpec(baseSpec, notes, head),
    designs: baseSpec.designs.filter((entry) => entry.domainId === "d1" && entry.status === "actionable"),
    decisions,
    changedFiles: ["src/lib/map/data.ts", ACCEPTED_DESIGNS_FILE],
  };
}

test("the refactor diff admits exactly the decided changes within their designs", () => {
  assert.deepEqual(validateRefactorDiff(runDiff()), { ok: true, problems: [], changed: ["single"], kept: [] });
  // A downgrade to keep leaves the record as reviewed: only the spec records it.
  const keptRun = runDiff((head) => withRecord(head, "single", { body: recordOf(model(), "single").body }), { single: "keep" });
  assert.deepEqual(validateRefactorDiff({ ...keptRun, changedFiles: [ACCEPTED_DESIGNS_FILE] }), { ok: true, problems: [], changed: [], kept: ["single"] });
});

test("the refactor diff rejects KEEP, blocked, sibling and kept changes", () => {
  const problems = (input: Parameters<typeof validateRefactorDiff>[0]) => validateRefactorDiff(input).problems.join("\n");
  // done is KEEP in Domain One; k is another domain's KEEP; c is blocked.
  assert.match(problems(runDiff((head) => withRecord(head, "done", { definition: "Changed." }))), /done changed without an accepted actionable design/);
  assert.match(problems(runDiff((head) => withRecord(head, "k", { definition: "Changed." }))), /k changed without an accepted actionable design/);
  assert.match(problems(runDiff((head) => withRecord(head, "c", { body: [{ kind: "paragraph", text: "Changed." }] }))), /c changed without an accepted actionable design/);
  // t has an actionable design, but in Domain Two: a Domain One run may not touch it.
  assert.match(problems(runDiff((head) => withRecord(head, "t", { body: [...recordOf(head, "t").body!, COMPARISON] }))), /t changed without an accepted actionable design in this run/);
  assert.match(problems(runDiff((head) => head, { single: "keep" })), /single changed although it was reconsidered as keep/);
  assert.match(problems({ ...runDiff(), decisions: {} }), /single: no decision recorded/);
});

test("the refactor diff rejects added or removed records, registry, taxonomy, identity, view and file changes", () => {
  const problems = (input: Parameters<typeof validateRefactorDiff>[0]) => validateRefactorDiff(input).problems.join("\n");
  assert.match(problems(runDiff((head) => ({ ...head, content: [...head.content, { id: "a-content", conceptId: "a", definition: "Alpha." }] }))), /content added: a/);
  assert.match(problems(runDiff((head) => ({ ...head, content: head.content.filter((record) => record.conceptId !== "k") }))), /content removed: k/);
  assert.match(problems(runDiff((head) => ({ ...head, content: head.content.map((record) => (record.conceptId === "single" ? { ...record, id: "renamed" } : record)) }))), /content id changed: renamed/);
  assert.match(problems({ ...runDiff(), headRegistry: [...registryOf(model()), "extra"] }), /the content registry changed/);
  assert.match(problems(runDiff((head) => ({ ...head, placements: head.placements.map((placement) => (placement.id === "t-in-d1" ? { ...placement, order: 9 } : placement)) }))), /placements changed/);
  assert.match(problems(runDiff((head) => ({ ...head, concepts: head.concepts.map((concept) => (concept.id === "single" ? { ...concept, title: "Renamed" } : concept)) }))), /concepts changed/);
  assert.match(problems({ ...runDiff(), headView: { roots: [1] } }), /generated explorer view changed/);
  assert.match(problems({ ...runDiff(), changedFiles: ["src/lib/map/data.ts", ACCEPTED_DESIGNS_FILE, "src/lib/map/authoring/content-registry.ts"] }), /unexpected changed file: src\/lib\/map\/authoring\/content-registry.ts/);
  assert.match(problems({ ...runDiff(), changedFiles: ["src/lib/map/data.ts", ".map-authoring/refactor/d1.json"] }), /local-only path/);
  // A declared general fix is the one other file class, within the fix policy.
  const fix = { kind: "test", message: "test(map): derive an expectation", files: ["src/lib/map/x.test.ts"] };
  assert.deepEqual(validateRefactorDiff({ ...runDiff(), changedFiles: ["src/lib/map/data.ts", ACCEPTED_DESIGNS_FILE, "src/lib/map/x.test.ts"], fixes: [fix], fixLines: 4 }).problems, []);
});

test("the spec may change only by resolving this run's designs, consistently with the records", () => {
  const problems = (input: Parameters<typeof validateRefactorDiff>[0]) => validateRefactorDiff(input).problems.join("\n");
  const run = runDiff();
  const tampered = { ...run.headSpec, designs: run.headSpec.designs.map((entry) => (entry.conceptId === "single" ? { ...entry, target: [{ structure: "comparison" as const, purpose: "swapped" }] } : entry)) };
  assert.match(problems({ ...run, headSpec: tampered }), /single: its accepted design changed/);
  const otherResolved = resolveSpec(run.headSpec, { t: { decision: "keep", note: "not this run" } }, run.head);
  assert.match(problems({ ...run, headSpec: otherResolved }), /t: resolution changed outside this run's decisions/);
  assert.match(problems({ ...run, headSpec: run.baseSpec }), /single: decided in this run but not resolved/);
  const wrongFingerprint = { ...run.headSpec, designs: run.headSpec.designs.map((entry) => (entry.conceptId === "single" ? { ...entry, resolution: { ...entry.resolution!, resultFingerprint: "x" } } : entry)) };
  assert.match(problems({ ...run, headSpec: wrongFingerprint }), /resolutions do not match/);
});

function refactorState(): RunState {
  const m = model();
  const plan = planRefactor(spec(m), m, "d1");
  return createRefactorRunState({ plan, designSet: designSetFingerprint(spec(m), "d1"), branch: refactorBranch("d1"), baseSha: "a".repeat(40), now: "t0" });
}

test("a refactor run records one decision per actionable design, safely replayed and revisable during the audit", () => {
  const state = refactorState();
  assert.deepEqual([state.kind, state.branch, state.plan.eligible, state.refactor!.blocked, state.refactor!.keep], ["refactor", "refactor/map-d1-l1-representations", ["single"], [], ["c", "done", "t"]]);
  const action = nextAction(state);
  assert.match(action.kind === "agent" ? action.message : "", /refactor context single/);
  const decided = recordDecision(state, "single", "execute", "the loop carries the meaning", "t1");
  assert.equal(decided.stage, "audit");
  assert.equal(recordDecision(decided, "single", "execute", "the loop carries the meaning", "t2"), decided);
  assert.throws(() => recordDecision(state, "single", "keep", " ", "t1"), /needs a note/);
  assert.throws(() => recordDecision(state, "done", "keep", "x", "t1"), /not an actionable design/);
  // The audit may revise a decision without rewinding the run.
  const revised = recordDecision(decided, "single", "keep", "on reflection prose suffices", "t3");
  assert.deepEqual([revised.stage, revised.refactor!.decisions.single.decision], ["audit", "keep"]);
  assert.throws(() => recordDecision({ ...decided, stage: "gates" }, "single", "keep", "x", "t4"), /cannot change a decision at stage gates/);
  // Nothing to refactor, or designs reviewed against other content: no run.
  const m = model();
  assert.throws(() => createRefactorRunState({ plan: planRefactor(spec(m), m, "d3"), designSet: "x", branch: "b", baseSha: "s", now: "t" }), /nothing to refactor/);
  const edited = withRecord(m, "single", { definition: "Changed." });
  assert.throws(() => createRefactorRunState({ plan: planRefactor(spec(m), edited, "d1"), designSet: "x", branch: "b", baseSha: "s", now: "t" }), /reviewed against different content/);
});

test("a resumed refactor run trusts no verification made against another tree", () => {
  let state = recordDecision(refactorState(), "single", "execute", "x", "t1");
  state = completeStage(state, "audit", "t2", "audited");
  state = { ...state, auditContent: "content", checks: { test: { ok: true, at: "t3", detail: "ok", tree: "tree-1" } }, stage: "browser", completed: { ...state.completed, gates: { at: "t3" } }, buildId: "build-1" };
  assert.equal(invalidate(state, { tree: "tree-1", content: "content", buildId: "build-1" }).state, state);
  assert.equal(invalidate(state, { tree: "tree-2", content: "content", buildId: "build-1" }).state.stage, "gates");
  assert.equal(invalidate(state, { tree: "tree-1", content: "content", buildId: "build-2" }).state.stage, "gates");
  assert.equal(invalidate(state, { tree: "tree-1", content: "edited", buildId: "build-1" }).state.stage, "audit");
});

test("resuming proves the recorded git and remote state", () => {
  const state = { ...refactorState(), commits: [{ sha: "c".repeat(40), message: "m", files: ["f"] }], pushedSha: "c".repeat(40) };
  const observed = { branch: state.branch, head: "c".repeat(40), baseIsAncestor: true, trackedChanges: [], remoteHead: "c".repeat(40) };
  assert.deepEqual(gitProblems(state, observed), []);
  assert.match(gitProblems(state, { ...observed, branch: "main" }).join(), /on branch main, the run is on refactor\/map-d1-l1-representations/);
  assert.match(gitProblems(state, { ...observed, head: "d".repeat(40) }).join(), /HEAD is ddddddd, the run recorded ccccccc/);
  assert.match(gitProblems(state, { ...observed, remoteHead: "e".repeat(40) }).join(), /origin\/refactor\/map-d1-l1-representations is eeeeeee, the run pushed ccccccc/);
  assert.match(gitProblems(state, { ...observed, trackedChanges: ["src/lib/map/data.ts"] }).join(), /tracked changes after the run's commits/);
  assert.match(gitProblems(state, { ...observed, baseIsAncestor: false }).join(), /is not an ancestor/);
  // The PR must target main and carry exactly the pushed commit.
  const pr = { number: 7, url: "u", state: "OPEN", headRefOid: "c".repeat(40), baseRefName: "main" };
  assert.equal(prMismatch(state.pushedSha, pr), undefined);
  assert.match(prMismatch(state.pushedSha, { ...pr, baseRefName: "develop" })!, /targets develop, not main/);
  assert.match(prMismatch(state.pushedSha, { ...pr, headRefOid: "f".repeat(40) })!, /is at fffffff/);
});

test("starting a run refuses duplicates, open MAP run PRs of either kind and an unsafe baseline", () => {
  const clean: ObservedStart = { existingRun: false, trackedChanges: [], branch: "main", localMainAhead: false, remoteMain: "m", branchExists: false, openRunPrs: [], prsReadable: true };
  const branch = refactorBranch("d1");
  assert.deepEqual(startProblems(branch, clean), []);
  assert.match(startProblems(branch, { ...clean, branchExists: true }).join(), /branch refactor\/map-d1-l1-representations already exists/);
  assert.match(startProblems(branch, { ...clean, openRunPrs: [{ number: 3, title: "MAP: X L1 representations", headRefName: refactorBranch("d2") }] }).join(), /unmerged MAP run PRs: #3/);
  assert.match(startProblems(branch, { ...clean, trackedChanges: ["src/lib/map/data.ts"] }).join(), /tracked changes present/);
  assert.match(startProblems(branch, { ...clean, branch: "feature" }).join(), /start from main/);
  assert.match(startProblems(branch, { ...clean, localMainAhead: true }).join(), /local main has commits/);
  assert.match(startProblems(branch, { ...clean, prsReadable: false }).join(), /cannot read open PRs/);
  for (const name of ["feat/map-oracles-l1", "refactor/map-oracles-l1-representations"]) assert.ok(MAP_RUN_BRANCH.test(name), name);
  for (const name of ["feat/map-representation-audit", "refactor/map-oracles"]) assert.ok(!MAP_RUN_BRANCH.test(name), name);
});

test("commits reconstruct exactly the validated files: fixes first, then the refactor", () => {
  const state: RunState = {
    ...refactorState(),
    fixes: [{ kind: "test", message: "test(map): derive it", files: ["src/lib/map/x.test.ts"], reason: "r" }],
    validatedFiles: { "src/lib/map/data.ts": "b1", [ACCEPTED_DESIGNS_FILE]: "b2", "src/lib/map/x.test.ts": "b3" },
  };
  const groups = commitGroups(state, { fix: (fix) => fix.message, content: "refactor(map): improve domain one L1 representations" });
  assert.deepEqual(groups, [
    { message: "test(map): derive it", files: ["src/lib/map/x.test.ts"] },
    { message: "refactor(map): improve domain one L1 representations", files: ["src/lib/map/data.ts", ACCEPTED_DESIGNS_FILE] },
  ]);
  const blobs: Record<string, string> = { "src/lib/map/data.ts": "b1", [ACCEPTED_DESIGNS_FILE]: "b2", "src/lib/map/x.test.ts": "b3" };
  const committed = groups.flatMap((group) => group.files);
  assert.deepEqual(compositionProblems(state.validatedFiles!, { files: committed, blobAtHead: (file) => blobs[file] }), []);
  assert.match(compositionProblems(state.validatedFiles!, { files: committed, blobAtHead: (file) => (file === ACCEPTED_DESIGNS_FILE ? "other" : blobs[file]) }).join(), /differing from validation/);
  assert.match(compositionProblems(state.validatedFiles!, { files: committed.slice(1), blobAtHead: (file) => blobs[file] }).join(), /committed/);
});

test("the refactor commit names semantic changes and keeps acronyms", () => {
  const state = recordDecision({ ...refactorState(), title: "MEV & Execution Markets" }, "single", "execute", "x", "t");
  const message = refactorCommitMessage(state, "Trailer: x");
  assert.match(message, /^refactor\(map\): improve MEV and execution markets L1 representations\n/);
  assert.match(message, /Changed within their accepted designs: single\./);
  assert.match(message, /Trailer: x\n$/);
});

test("the repository's accepted-design spec is valid governance for the current corpus", () => {
  const spec = JSON.parse(readFileSync(new URL("./accepted-designs.json", import.meta.url), "utf8")) as AcceptedDesignSpec;
  assert.deepEqual(specProblems(spec, mapKnowledge), []);
  assert.ok(spec.designs.every((entry) => entry.placements.length > 0 && entry.target.length > 0));
});
