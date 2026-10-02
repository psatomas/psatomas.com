import assert from "node:assert/strict";
import test from "node:test";
import { mapKnowledge } from "../../data.ts";
import { atL2Checkpoint, clearL2Checkpoint, completeStage, createL2RunState, nextAction, pendingL2Steps, recordL2Step, RunStateError, STAGES, type RunState } from "../orchestrator/run-state.ts";
import { MAP_RUN_BRANCH } from "../representation/refactor.ts";
import { DATA_FILE, finishedConcepts, groupCommitMessage, groupCommitTrees, l2Branch, l2PrBody, l2PrTitle, l2Slices, pilotSlice, recordSpans, REGISTRY_FILE, sliceRemaining, sliceSteps, stepKey, viewWithout, VIEW_FILE, withoutRecords, withoutRegistryEntries } from "./campaign.ts";
import { filledG1, model, REGISTRY } from "./fixtures.ts";

const NOW = "2026-10-02T00:00:00.000Z";

test("slices are whole ownership groups in canonical order, balanced under the limit, and stable", () => {
  const slices = l2Slices(model(), { registry: REGISTRY, limit: 2 });
  assert.deepEqual(slices.map((slice) => [slice.id, slice.groups.map((group) => [group.group, group.concepts])]), [
    ["d1-1", [["g1", ["a", "b"]]]],
    ["d2-1", [["g2", ["s", "t", "u"]]]],
  ]);
  assert.equal(l2Branch(slices[0]), "feat/map-d1-l2-1");
  assert.ok(MAP_RUN_BRANCH.test("feat/map-d1-l2-1") && MAP_RUN_BRANCH.test("feat/map-l2-pilot"));
  // The corpus: every l2-only concept in exactly one slice, none above the limit.
  const corpus = l2Slices(mapKnowledge);
  const concepts = corpus.flatMap((slice) => slice.groups.flatMap((group) => group.concepts));
  assert.equal(concepts.length, new Set(concepts).size);
  assert.equal(concepts.length, 1604);
  assert.ok(corpus.every((slice) => slice.groups.reduce((sum, group) => sum + group.concepts.length, 0) <= 30));
  assert.deepEqual(corpus.slice(0, 2).map((slice) => slice.id), ["foundations-1", "foundations-2"]);
});

test("the pilot names its groups; a concept is finished once authored or blocked by its design", () => {
  const pilot = pilotSlice(model(), ["g2", "g1"], REGISTRY);
  assert.deepEqual([pilot.id, l2Branch(pilot), pilot.groups.map((group) => group.group)], ["pilot", "feat/map-l2-pilot", ["g2", "g1"]]);
  assert.throws(() => pilotSlice(model(), ["d1"], REGISTRY), /not an ownership group/);
  const plan = filledG1();
  plan.concepts = { b: { design: { decision: "block" } } };
  const finished = finishedConcepts(model([{ id: "a-content", conceptId: "a", definition: "A." }]), [plan]);
  assert.deepEqual(sliceRemaining(l2Slices(model(), { registry: REGISTRY, limit: 2 })[0], finished), []);
});

test("a slice's steps: every plan, then every design, then drafting and audit per concept, then group audits", () => {
  const steps = sliceSteps([{ group: "g1", concepts: ["a", "b"] }, { group: "g2", concepts: ["s"] }]).map(stepKey);
  assert.deepEqual(steps, ["plan:g1", "plan:g2", "design:a", "design:b", "design:s", "author:a", "audit:a", "author:b", "audit:b", "author:s", "audit:s", "group-audit:g1", "group-audit:g2"]);
});

const run = (pilot = false): RunState => createL2RunState({ slice: pilotSlice(model(), ["g1"], REGISTRY), remaining: ["a", "b"], branch: "feat/map-l2-pilot", baseSha: "base", now: NOW, pilot });

test("an L2 run records its steps in order, skips a blocked concept and counts repairs", () => {
  let state = run();
  assert.equal(state.kind, "l2");
  assert.throws(() => recordL2Step(state, { kind: "design", subject: "a" }, NOW), /record plan:g1 first/);
  assert.match((nextAction(state) as { message: string }).message, /write g1's territory plan/);
  state = recordL2Step(state, { kind: "plan", subject: "g1" }, NOW);
  state = recordL2Step(state, { kind: "design", subject: "a" }, NOW);
  state = recordL2Step(state, { kind: "design", subject: "b" }, NOW, { blocks: true });
  assert.deepEqual([state.l2!.blocked, state.concepts.b.done], [["b"], true]);
  state = recordL2Step(state, { kind: "author", subject: "a" }, NOW);
  state = recordL2Step(state, { kind: "audit", subject: "a" }, NOW);
  // Every concept is audited or blocked: the run moves to the group audits.
  assert.equal(state.stage, "audit");
  assert.deepEqual(pendingL2Steps(state).map(stepKey), ["group-audit:g1"]);
  assert.throws(() => completeStage(state, "audit", NOW), /group audits still to record: g1/);
  // Re-authoring after the audit is a repair, and reopens the concept.
  const stepsBefore = recordL2Step(run(), { kind: "plan", subject: "g1" }, NOW);
  let repaired = recordL2Step(recordL2Step(stepsBefore, { kind: "design", subject: "a" }, NOW), { kind: "design", subject: "b" }, NOW);
  repaired = recordL2Step(recordL2Step(repaired, { kind: "author", subject: "a" }, NOW), { kind: "audit", subject: "a" }, NOW);
  repaired = recordL2Step(repaired, { kind: "author", subject: "a" }, NOW);
  assert.deepEqual([repaired.l2!.repairs.a, repaired.concepts.a.done, pendingL2Steps(repaired).map(stepKey)[0]], [1, false, "audit:a"]);
  state = recordL2Step(state, { kind: "group-audit", subject: "g1" }, NOW);
  state = completeStage(state, "audit", NOW, "audited");
  assert.equal(state.stage, "gates");
});

test("the pilot holds drafting at its checkpoint until a human clears it", () => {
  let state = run(true);
  state = recordL2Step(state, { kind: "plan", subject: "g1" }, NOW);
  assert.throws(() => clearL2Checkpoint(state, "reviewed", NOW), /every plan and design must be recorded/);
  state = recordL2Step(recordL2Step(state, { kind: "design", subject: "a" }, NOW), { kind: "design", subject: "b" }, NOW);
  assert.equal(atL2Checkpoint(state), true);
  assert.match((nextAction(state) as { message: string }).message, /pilot checkpoint/);
  assert.throws(() => recordL2Step(state, { kind: "author", subject: "a" }, NOW), /checkpoint holds drafting/);
  assert.throws(() => clearL2Checkpoint(state, " ", NOW), RunStateError);
  state = clearL2Checkpoint(state, "plans and designs reviewed and accepted", NOW);
  assert.equal(atL2Checkpoint(state), false);
  assert.equal(recordL2Step(state, { kind: "author", subject: "a" }, NOW).l2!.steps["author:a"].at, NOW);
});

test("an L2 run merges its own PR only with a recorded human authorization", () => {
  const toCi = (state: RunState) => {
    let current: RunState = { ...state, stage: "gates" };
    for (const stage of STAGES.slice(STAGES.indexOf("gates"), STAGES.indexOf("ci") + 1)) current = completeStage(current, stage, NOW);
    return current;
  };
  assert.equal(toCi(run()).stage, "done");
  assert.equal(toCi(run()).completed.merge?.detail, "awaiting human merge");
  const authorized = { ...run(), l2: { ...run().l2!, mergeAuthorized: { at: NOW, authorization: "campaign authorized" } } };
  assert.equal(toCi(authorized).stage, "merge");
  assert.equal(completeStage(toCi(authorized), "merge", NOW).stage, "done");
});

const BASE_DATA = ["export const mapKnowledge = {", "  content: [", "    {", '      id: "old-content",', '      conceptId: "old",', "    },", "  ],", "};", ""].join("\n");
const record = (id: string) => ["    {", `      id: "${id}-content",`, `      conceptId: "${id}",`, '      body: [{ kind: "paragraph", text: "x" }],', "    },"];
const FINAL_DATA = ["export const mapKnowledge = {", "  content: [", "    {", '      id: "old-content",', '      conceptId: "old",', "    },", ...record("a"), ...record("b"), ...record("s"), "  ],", "};", ""].join("\n");
const BASE_REGISTRY = ["export const AUTHORED_CONTENT_CONCEPTS = [", '  "old",', "];", ""].join("\n");
const FINAL_REGISTRY = ["export const AUTHORED_CONTENT_CONCEPTS = [", '  "old",', '  "a",', '  "b",', '  "s",', "];", ""].join("\n");
const view = (flags: Record<string, boolean>) => `${JSON.stringify({ roots: [{ placementId: "d1", hasContent: true, children: Object.entries(flags).map(([placementId, hasContent]) => ({ placementId, hasContent, children: [] })) }] })}\n`;

test("group commits are the exact trees after each group, proven by giving back the base", () => {
  assert.deepEqual([...recordSpans(FINAL_DATA).keys()], ["old", "a", "b", "s"]);
  assert.equal(withoutRecords(FINAL_DATA, ["a", "b", "s"]), BASE_DATA);
  assert.equal(withoutRegistryEntries(FINAL_REGISTRY, ["a", "b", "s"]), BASE_REGISTRY);
  assert.equal(viewWithout(view({ a: true, b: true }), ["a"]), view({ a: false, b: true }));
  const m = model();
  const input = {
    model: m,
    groups: [
      { group: "g1", authored: ["a", "b"], file: "groups/g1.json" },
      { group: "g2", authored: ["s"], file: "groups/g2.json" },
    ],
    final: { [DATA_FILE]: FINAL_DATA, [REGISTRY_FILE]: FINAL_REGISTRY, [VIEW_FILE]: view({ a: true, b: true, s: true, "s-in-g1": true }), "groups/g1.json": "g1 plan\n", "groups/g2.json": "g2 plan\n" },
    base: { [DATA_FILE]: BASE_DATA, [REGISTRY_FILE]: BASE_REGISTRY, [VIEW_FILE]: view({ a: false, b: false, s: false, "s-in-g1": false }), "groups/g1.json": undefined, "groups/g2.json": undefined },
  };
  const { problems, trees } = groupCommitTrees(input);
  assert.deepEqual(problems, []);
  assert.equal(trees[0][DATA_FILE], withoutRecords(FINAL_DATA, ["s"]));
  assert.equal(trees[0][VIEW_FILE], view({ a: true, b: true, s: false, "s-in-g1": false }));
  assert.deepEqual([trees[0]["groups/g1.json"], trees[0]["groups/g2.json"]], ["g1 plan\n", undefined]);
  assert.equal(trees[1][DATA_FILE], FINAL_DATA);
  // An existing record changed along the way: removing the run's records cannot give back the base.
  const changed = groupCommitTrees({ ...input, final: { ...input.final, [DATA_FILE]: FINAL_DATA.replace('conceptId: "old"', 'conceptId: "old2"') } });
  assert.match(changed.problems.join(), /src\/lib\/map\/data\.ts: removing the run's records does not give back the base/);
  assert.match(groupCommitTrees({ ...input, groups: [{ group: "g1", authored: ["zzz"], file: "groups/g1.json" }] }).problems.join(), /no record block for zzz/);
});

test("commit and PR text name the groups, the authored and the blocked", () => {
  assert.equal(groupCommitMessage({ title: "Group One", authored: ["a"], blocked: ["b"] }, "Trailer: x").split("\n")[0], "feat(map): author Group One L2 topics");
  assert.match(groupCommitMessage({ title: "Group One", authored: ["a"], blocked: ["b"] }), /Blocked by a missing representation, unauthored: b\./);
  const slice = l2Slices(model(), { registry: REGISTRY, limit: 2 })[0];
  assert.equal(l2PrTitle(slice), "feat(map): author Domain One L2 topics, part 1");
  assert.equal(l2PrTitle(pilotSlice(model(), ["g1"], REGISTRY)), "feat(map): author the L2 pilot");
  const body = l2PrBody({ slice, groups: [{ group: "g1", title: "Group One", authored: ["a"], blocked: ["b"] }], checks: { gates: { ok: true, detail: "passed" } }, fixes: [], auditNotes: ["fine"], footer: "footer" });
  assert.match(body, /\*\*Group One\*\* \(`g1`\): a; blocked: b/);
  assert.match(body, /- gates: passed/);
});
