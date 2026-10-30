import assert from "node:assert/strict";
import test from "node:test";
import type { MapConceptContent, MapKnowledgeModel } from "../../types.ts";
import { createL2RunState, humanMerge, partialStartProblems, pendingL2Steps, repairOriginal, RunStateError, type RunState } from "../orchestrator/run-state.ts";
import { contentFingerprint } from "../representation/design.ts";
import { MAP_RUN_BRANCH } from "../representation/refactor.ts";
import { finishedConcepts, l2Branch, l2PrBody, l2PrTitle, l2RepairBranch, l2RunId, L2ScopeError, pilotSlice, selectGroups, sliceRemaining, stepKey, type L2RunScope, type L2Slice } from "./campaign.ts";
import { auditCoverageProblems, type L2Audit } from "./contracts.ts";
import { validateL2Diff, type L2DiffInput } from "./diff.ts";
import { filledG1, filledG2, HAZARDS, model, REGISTRY } from "./fixtures.ts";
import { inventoryL2 } from "./inventory.ts";
import { crossPlanProblems, groupFile, type L2GroupFile } from "./territory.ts";

// Partial-slice runs (`l2 start --slice <id> --groups <g,..>`): a slice's groups run and integrate one selection at a
// time. The fixture slice holds g1 (a, b; reserves "what shared things share" for s) and g2 (s, t, u; owns s, and u is
// already authored), the shape of state-data-1's state-representation and state-commitments (state-roots).

const T0 = "2026-10-30T00:00:00.000Z";
const SIMPLIFIED = { mode: "simplified", version: 1 } as const;
const SLICE: L2Slice = {
  id: "d1-1",
  domain: "d1",
  domainTitle: "Domain One",
  ordinal: "01",
  index: 1,
  groups: [
    { group: "g1", title: "Group One", concepts: ["a", "b"] },
    { group: "g2", title: "Group Two", concepts: ["s", "t", "u"] },
  ],
};
const record = (conceptId: string): MapConceptContent => ({ id: `${conceptId}-content`, conceptId, definition: `${conceptId} is defined.`, body: [{ kind: "paragraph", text: `How ${conceptId} works.` }] });
const audit = (entry: MapConceptContent): L2Audit => ({ at: T0, note: "judged", resolutions: [], recordFingerprint: contentFingerprint(entry) });

const remainingIn = (m: MapKnowledgeModel, plans: L2GroupFile[] = []) => sliceRemaining(SLICE, finishedConcepts(m, plans));
const start = (groups: string[] | undefined, m = model()) => {
  const scope = groups ? selectGroups(SLICE, groups) : undefined;
  return createL2RunState({ slice: SLICE, remaining: remainingIn(m), branch: l2Branch(SLICE, scope?.part), baseSha: "base", now: T0, pipeline: SIMPLIFIED, ...(scope ? { scope } : {}) });
};
/** A run as the campaign leaves it: at a stage, with its PR pushed. */
const at = (state: RunState, stage: RunState["stage"]): RunState => ({ ...state, stage, pushedSha: "pushed" });

test("--groups selects known groups of the slice, in slice order, without repeats", () => {
  assert.deepEqual(selectGroups(SLICE, ["g1"]), { part: 1, groups: ["g1"], sliceGroups: ["g1", "g2"] });
  assert.deepEqual(selectGroups(SLICE, [" g2 ", "g1"]), { part: 1, groups: ["g1", "g2"], sliceGroups: ["g1", "g2"] });
  assert.equal(selectGroups(SLICE, ["g2"]).part, 2);
  assert.throws(() => selectGroups(SLICE, ["", " "]), (error) => error instanceof L2ScopeError && /at least one group/.test(error.message));
  assert.throws(() => selectGroups(SLICE, ["g1", "g9"]), (error) => error instanceof L2ScopeError && /not groups of slice d1-1: g9 \(its groups: g1, g2\)/.test(error.message));
  assert.throws(() => selectGroups(SLICE, ["g1", "g1"]), (error) => error instanceof L2ScopeError && /named twice: g1/.test(error.message));
});

test("a partial run's identity is deterministic, and a full-slice run keeps its own", () => {
  // Full slice: the names every existing run and branch already has.
  assert.equal(l2RunId(SLICE), "d1-1");
  assert.equal(l2Branch(SLICE), "feat/map-d1-l2-1");
  assert.equal(l2RepairBranch(SLICE, 1), "fix/map-d1-l2-1-repair-1");
  const pilot = pilotSlice(model(), ["g1"], REGISTRY);
  assert.equal(l2Branch(pilot), "feat/map-l2-pilot");
  // Partial: the slice position of the first selected group.
  assert.equal(l2RunId(SLICE, selectGroups(SLICE, ["g1"])), "d1-1-g1");
  assert.equal(l2Branch(SLICE, selectGroups(SLICE, ["g2"]).part), "feat/map-d1-l2-1-g2");
  // Every one is a MAP run branch, so an open PR on any of them blocks the next start.
  for (const branch of ["feat/map-d1-l2-1", "feat/map-d1-l2-1-g2", "fix/map-d1-l2-1-repair-1", "feat/map-l2-pilot"]) assert.ok(MAP_RUN_BRANCH.test(branch), branch);
  assert.ok(!MAP_RUN_BRANCH.test("feat/map-d1-l2-1-g"));
});

test("a partial run holds only its groups' steps, and persists its scope and pipeline", () => {
  const state = start(["g1"]);
  assert.equal(state.domainId, "d1-1-g1");
  assert.equal(state.branch, "feat/map-d1-l2-1-g1");
  assert.equal(state.title, "Domain One L2, part 1, Group One");
  assert.deepEqual(state.l2!.scope, { part: 1, groups: ["g1"], sliceGroups: ["g1", "g2"] });
  assert.deepEqual(state.l2!.pipeline, SIMPLIFIED);
  assert.deepEqual(state.l2!.slice.groups.map((group) => group.group), ["g1"]);
  assert.deepEqual(state.plan.eligible, ["a", "b"]);
  assert.deepEqual(pendingL2Steps(state).map(stepKey), ["plan:g1", "author:a", "audit:a", "author:b", "audit:b", "group-audit:g1"]);
  assert.equal(state.l2!.mergeAuthorized, undefined);
  // The record survives the round trip through its state file.
  assert.deepEqual(JSON.parse(JSON.stringify(state)), state);
});

test("a full-slice run is unchanged: every group, the slice's id and title, no scope", () => {
  const state = start(undefined);
  assert.equal(state.domainId, "d1-1");
  assert.equal(state.title, "Domain One L2, part 1");
  assert.equal("scope" in state.l2!, false);
  assert.deepEqual(state.l2!.slice.groups.map((group) => [group.group, group.concepts]), [["g1", ["a", "b"]], ["g2", ["s", "t"]]]);
  assert.deepEqual(pendingL2Steps(state).map(stepKey), ["plan:g1", "plan:g2", "author:a", "audit:a", "author:b", "audit:b", "author:s", "audit:s", "author:t", "audit:t", "group-audit:g1", "group-audit:g2"]);
});

test("continuation: the next selection authors only what is not on main, and an integrated group is refused", () => {
  // g1 integrated: a and b have records on main.
  const integrated = model([record("a"), record("b")]);
  const next = start(["g2"], integrated);
  assert.equal(next.domainId, "d1-1-g2");
  // u was authored before the campaign: it is excluded, as integrated concepts always are.
  assert.deepEqual(next.plan.eligible, ["s", "t"]);
  assert.deepEqual(next.l2!.slice.groups.map((group) => group.group), ["g2"]);
  assert.throws(() => start(["g1"], integrated), (error) => error instanceof RunStateError && /nothing left to author in g1: its concepts are already integrated/.test(error.message));
  assert.throws(() => start(["g1", "g2"], integrated), /nothing left to author in g1/);
  // A full-slice start after the partial one takes only the remainder.
  assert.deepEqual(start(undefined, integrated).plan.eligible, ["s", "t"]);
});

test("a run starts only when every earlier run of the slice is finished and integrated", () => {
  const g1 = start(["g1"]);
  const onMain = finishedConcepts(model([record("a"), record("b")]), []);
  const notOnMain = finishedConcepts(model(), []);
  const problems = (run: RunState, finished: ReadonlySet<string>) => partialStartProblems({ runs: [run], finished, id: "d1-1-g2" });
  assert.match(problems(at(g1, "author"), notOnMain).join(), /d1-1-g1 is still open \(stage author\): finish it, or stop it and decide its concepts \(a, b\), before starting d1-1-g2/);
  // Overlap: the open run still holds g1, so the whole slice cannot start either.
  assert.match(partialStartProblems({ runs: [at(g1, "pr")], finished: notOnMain, id: "d1-1" }).join(), /d1-1-g1 is still open/);
  assert.match(problems(at(g1, "merge"), onMain).join(), /d1-1-g1 is integrated on main but its run is still open \(stage merge\): finish it, or resolve its stop \(`l2 status --domain d1-1-g1`\)/);
  assert.match(problems(at(g1, "done"), notOnMain).join(), /d1-1-g1 finished, but its concepts a, b are not on main: integrate its PR first/);
  assert.deepEqual(problems(at(g1, "done"), onMain), []);
  // A blocked concept counts as finished: it is not waiting on main.
  assert.deepEqual(problems({ ...at(g1, "done"), l2: { ...g1.l2!, blocked: ["b"] } }, finishedConcepts(model([record("a")]), [])), []);
  // Repair runs are the merged runs' own business, not a claim on new groups.
  assert.deepEqual(problems({ ...at(g1, "author"), l2: { ...g1.l2!, repairOf: { run: "d1-1-g1", merged: "m" } } }, onMain), []);
});

test("a repair finds the one run that drafted its concepts, full-slice or partial", () => {
  const g1 = at(start(["g1"]), "done");
  const g2 = at(start(["g2"], model([record("a"), record("b")])), "done");
  assert.equal(repairOriginal([g1, g2], ["a", "b"]).domainId, "d1-1-g1");
  assert.equal(repairOriginal([g1, g2], ["t"]).domainId, "d1-1-g2");
  assert.equal(repairOriginal([at(start(undefined), "done")], ["a", "t"]).domainId, "d1-1");
  assert.throws(() => repairOriginal([g1, g2], ["a", "t"]), /no single run of the slice drafted every named concept \(a: d1-1-g1; t: d1-1-g2\): repair the concepts of one run at a time/);
  assert.throws(() => repairOriginal([g1, g2], ["u"]), /u: no run/);
});

test("the merge guard: a partial run carries no authorization of its own, and records a hand merge only at its pushed head", () => {
  assert.equal(start(["g1"]).l2!.mergeAuthorized, undefined);
  const run = at(start(["g1"]), "merge");
  assert.deepEqual(humanMerge(run, { state: "MERGED", mergeCommit: { oid: "m1" }, headRefOid: "pushed" }, T0), { merged: { sha: "m1", at: T0, byHand: true } });
  assert.ok("problem" in humanMerge(run, { state: "MERGED", mergeCommit: { oid: "m1" }, headRefOid: "other00" }, T0)!);
});

test("audit completeness covers exactly the selected groups' concepts", () => {
  const g1 = start(["g1"]);
  const plan: L2GroupFile = { ...filledG1(), pipeline: SIMPLIFIED, concepts: { a: { audit: audit(record("a")) } } };
  const coverage = (plans: L2GroupFile[]) => auditCoverageProblems(plans, g1.l2!.slice.groups, g1.l2!.blocked);
  // b's audit is missing; nothing is asked of g2, which this run does not hold.
  assert.deepEqual(coverage([plan]), ["g1: b has no concept work entry, so no recorded concept audit"]);
  assert.deepEqual(coverage([{ ...plan, concepts: { ...plan.concepts, b: { audit: audit(record("b")) } } }]), []);
  // The full slice asks for g2's too.
  assert.match(auditCoverageProblems([plan], start(undefined).l2!.slice.groups).join(), /g2: no plan/);
});

/** The diff of the g1 run, under the simplified pipeline: g2 has no plan yet, as in the five-concept pilot. */
function g1Diff(): L2DiffInput {
  const base = model();
  const records = [record("a"), record("b")];
  const head = model(records);
  const plan = { ...filledG1(base), pipeline: SIMPLIFIED, concepts: { a: { audit: audit(records[0]) }, b: { audit: audit(records[1]) } } } as L2GroupFile & { groupAudit?: unknown };
  plan.groupAudit = { at: T0, note: "boundaries hold", resolutions: [], records: { a: contentFingerprint(records[0]), b: contentFingerprint(records[1]) } };
  return {
    base,
    head,
    baseView: viewOf(base),
    headView: viewOf(head),
    baseRegistry: REGISTRY,
    headRegistry: [...REGISTRY, "a", "b"],
    changedFiles: ["src/lib/map/data.ts", "src/lib/map/authoring/content-registry.ts", "src/components/map/explorer-view.generated.json", groupFile("g1")],
    data: { added: ["    {", '      id: "a-content",'], deleted: 0 },
    registry: { added: ['  "a",', '  "b",'], deleted: 0 },
    fixes: [],
    fixLines: 0,
    groups: start(["g1"]).l2!.slice.groups.map((group) => group.group),
    basePlans: [],
    headPlans: [plan],
    signals: {},
    groupSignals: {},
    hazards: HAZARDS,
  };
}
type Node = { placementId: string; hasContent: boolean; children: Node[] };
function viewOf(m: MapKnowledgeModel): { roots: Node[] } {
  const withContent = new Set(m.content.map((entry) => entry.conceptId));
  const node = (id: string): Node => ({
    placementId: id,
    hasContent: withContent.has(m.placements.find((placement) => placement.id === id)!.conceptId),
    children: m.placements.filter((placement) => placement.parentPlacementId === id).sort((a, b) => a.order - b.order).map((placement) => node(placement.id)),
  });
  return { roots: m.placements.filter((placement) => !placement.parentPlacementId).map((placement) => node(placement.id)) };
}

test("ownership: a partial run's diff is its groups' concepts; another group's plan or record is refused", () => {
  assert.deepEqual(validateL2Diff(g1Diff()).problems, []);
  // Writing g2's plan in the g1 run is another group's change.
  const withG2 = g1Diff();
  withG2.headPlans = [...withG2.headPlans, filledG2()];
  assert.match(validateL2Diff(withG2).problems.join(), /another group's plan changed: g2/);
  // Authoring s, a concept of the group not selected, is a record the run does not own.
  const withS = g1Diff();
  withS.head = model([record("a"), record("b"), record("s")]);
  withS.headView = viewOf(withS.head);
  withS.headRegistry = [...withS.headRegistry, "s"];
  assert.match(validateL2Diff(withS).problems.join("\n"), /added content \["a","b","s"\] differs from the run's authored concepts \["a","b"\]/);
});

test("cross-group dependencies: a reservation made by an earlier run binds the owner's plan in a later run", () => {
  const inventory = inventoryL2(model(), { authoredContent: REGISTRY });
  // The g1 run: s's owner has no plan yet, so the reservation waits for it.
  assert.deepEqual(crossPlanProblems([filledG1()], inventory), []);
  // The g2 run: its plan must claim, or revise with a reason, what g1 reserved for s.
  const unclaimed = filledG2();
  unclaimed.members.find((member) => member.conceptId === "s")!.claims = ["what makes shared things one"];
  assert.match(crossPlanProblems([filledG1(), unclaimed], inventory).join(), /s: reserved by g1 as "what shared things share", but its owner's plan \(g2\) neither claims nor revises it/);
  assert.deepEqual(crossPlanProblems([filledG1(), filledG2()], inventory), []);
  // The g2 run's diff checks it too, against the g1 plan already on main.
  const g1OnMain = { ...filledG1(), pipeline: SIMPLIFIED } as L2GroupFile;
  assert.match(crossPlanProblems([g1OnMain, unclaimed], inventory).join(), /neither claims nor revises it/);
});

test("a partial run's PR names its groups; a full-slice PR is unchanged", () => {
  const g1 = start(["g1"]);
  assert.equal(l2PrTitle(SLICE), "feat(map): author Domain One L2 topics, part 1");
  assert.equal(l2PrTitle(g1.l2!.slice, false, g1.l2!.scope), "feat(map): author Domain One L2 topics, part 1: Group One");
  const body = (scope?: L2RunScope) =>
    l2PrBody({ slice: g1.l2!.slice, groups: [{ group: "g1", title: "Group One", authored: ["a", "b"], blocked: [] }], checks: {}, fixes: [], auditNotes: [], ...(scope ? { scope, run: g1.domainId } : {}) });
  assert.match(body(g1.l2!.scope), /Partial run `d1-1-g1`: 1 of the slice's 2 ownership groups \(g1\); the others run separately/);
  assert.doesNotMatch(body(), /Partial run/);
});
