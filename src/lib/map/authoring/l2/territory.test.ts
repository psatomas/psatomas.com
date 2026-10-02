import assert from "node:assert/strict";
import test from "node:test";
import { mapKnowledge } from "../../data.ts";
import type { MapConceptContent, MapKnowledgeModel } from "../../types.ts";
import { assembleL2Context, formatL2Context, mentionsOf } from "./context.ts";
import { inventoryL2 } from "./inventory.ts";
import { crossPlanProblems, planProblems, planSkeleton, staleProblems, type L2GroupFile, type L2Hazards } from "./territory.ts";

/**
 * Domain One: group g1 holds a and b (owned), s-in-g1 (s, owned by g2) and
 * u-in-g1 (u, owned by g2, already authored). Domain Two: group g2 holds s,
 * t, u (owned) and g1-in-g2 (g1, dual-role). Hazards: a ~ t are
 * near-synonyms; s is a category of t.
 */
function model(content: MapConceptContent[] = []): MapKnowledgeModel {
  const titles: Record<string, string> = { d1: "Domain One", d2: "Domain Two", g1: "Group One", g2: "Group Two", a: "Alpha", b: "Beta", s: "Shared", t: "Tango", u: "Uniform" };
  const placements = [
    { id: "d1", conceptId: "d1", order: 0 },
    { id: "d2", conceptId: "d2", order: 1 },
    { id: "g1", conceptId: "g1", parentPlacementId: "d1", order: 0 },
    { id: "g2", conceptId: "g2", parentPlacementId: "d2", order: 0 },
    { id: "a", conceptId: "a", parentPlacementId: "g1", order: 0 },
    { id: "b", conceptId: "b", parentPlacementId: "g1", order: 1 },
    { id: "s-in-g1", conceptId: "s", parentPlacementId: "g1", order: 2 },
    { id: "u-in-g1", conceptId: "u", parentPlacementId: "g1", order: 3 },
    { id: "s", conceptId: "s", parentPlacementId: "g2", order: 0 },
    { id: "t", conceptId: "t", parentPlacementId: "g2", order: 1 },
    { id: "u", conceptId: "u", parentPlacementId: "g2", order: 2 },
    { id: "g1-in-g2", conceptId: "g1", parentPlacementId: "g2", order: 3 },
  ];
  const preferred: Record<string, string> = { s: "s", u: "u", g1: "g1" };
  return {
    concepts: Object.entries(titles).map(([id, title]) => ({ id, slug: id, title, ...(preferred[id] ? { preferredPlacementId: preferred[id] } : {}) })),
    placements,
    relationships: [],
    content: [
      { id: "d1-content", conceptId: "d1", definition: "Domain One is a domain.", body: [{ kind: "paragraph", text: "Alpha matters here. Nothing else does." }, { kind: "terms", terms: ["Alpha", "Beta"] }] },
      { id: "g1-content", conceptId: "g1", definition: "Group One groups things.", body: [{ kind: "paragraph", text: "Alphas come first. Betas follow them. Shared things are elsewhere." }] },
      { id: "u-content", conceptId: "u", definition: "Uniform is authored." },
      ...content,
    ],
    mechanisms: [],
    knowledgePaths: [],
  };
}
const HAZARDS: L2Hazards = {
  nearSynonyms: [{ concepts: ["a", "t"], note: "close" }],
  categoryMembers: [{ category: "s", members: ["t"], scope: "cross group" }],
  multiAxisGroups: [],
  facetWatch: [],
  stateCandidates: { strong: ["b"], moderate: [] },
  verticalBoundary: [],
};
const REGISTRY = ["d1", "g1", "u"];
const options = { registry: REGISTRY, hazards: HAZARDS };

function filledG1(m = model()): L2GroupFile {
  const plan = planSkeleton(m, "g1", options);
  plan.members.find((member) => member.conceptId === "a")!.claims = ["how alpha starts"];
  plan.members.find((member) => member.conceptId === "b")!.claims = ["how beta follows"];
  plan.members.find((member) => member.conceptId === "s")!.reserved = ["what shared things share"];
  plan.splits = [{ concepts: ["a", "t"], split: "alpha is the start; tango is the dance" }];
  return plan;
}
function filledG2(m = model()): L2GroupFile {
  const plan = planSkeleton(m, "g2", options);
  plan.members.find((member) => member.conceptId === "s")!.claims = ["what shared things share"];
  plan.members.find((member) => member.conceptId === "t")!.claims = ["how tango moves"];
  plan.splits = plan.splits.map((entry) => ({ ...entry, split: "the category names its members; each member owns its mechanism" }));
  return plan;
}

test("a skeleton lists every member with its standing and leaves only judgments empty", () => {
  const plan = planSkeleton(model(), "g1", options);
  assert.deepEqual(plan.members.map((member) => [member.conceptId, member.standing]), [["a", "owned"], ["b", "owned"], ["s", "owned-elsewhere"], ["u", "owned-elsewhere"]]);
  assert.deepEqual(plan.members.map((member) => Object.keys(member).filter((key) => !["conceptId", "placementId", "standing"].includes(key))), [["claims", "excludes"], ["claims", "excludes"], ["reserved"], []]);
  assert.deepEqual(plan.splits, [{ concepts: ["a", "t"], split: "" }]);
  assert.deepEqual(Object.keys(plan.basis.fixed), ["u"]);
  assert.deepEqual(Object.keys(plan.basis.parents).sort(), ["d1", "g1"]);
  assert.deepEqual(plan.concepts, {});
});

test("an unfilled plan is refused for every missing judgment; a filled one is valid", () => {
  const problems = planProblems(planSkeleton(model(), "g1", options), model(), options).join("\n");
  for (const expected of [/a: an owned member needs at least one non-empty claim/, /b: an owned member needs/, /s: an unauthored member owned elsewhere needs its reserved territory/, /hazard a ~ t: record how the territory is split/]) assert.match(problems, expected);
  assert.deepEqual(planProblems(filledG1(), model(), options), []);
});

test("a plan gives each claim one owner, keeps reservations apart and names only real concepts", () => {
  const plan = filledG1();
  plan.members.find((member) => member.conceptId === "b")!.claims = ["How alpha starts!"];
  plan.members.find((member) => member.conceptId === "a")!.excludes = ["nope", "a"];
  plan.members.find((member) => member.conceptId === "s")!.reserved = ["how beta follows", "how alpha starts"];
  plan.members.find((member) => member.conceptId === "u")!.reserved = ["something"];
  plan.splits.push({ concepts: ["b", "s"], split: "x" });
  plan.concepts = { s: {} };
  const problems = planProblems(plan, model(), options).join("\n");
  for (const expected of [/b: claim "How alpha starts!" is also a's/, /a: excludes unknown concept nope/, /a: excludes itself/, /s: reserved claim "how alpha starts" is claimed by/, /u: already authored, so its record is its fixed territory/, /split b ~ s answers no hazard/, /concept work for s, which this group does not own/]) {
    assert.match(problems, expected);
  }
  assert.match(planProblems({ ...filledG1(), members: filledG1().members.slice(1) }, model(), options).join(), /members must be the group's placements in order/);
});

test("a plan goes stale when its parents, fixed members, membership or hazards change", () => {
  const plan = filledG1();
  assert.deepEqual(staleProblems(plan, model(), options), []);
  const edited = model();
  edited.content = edited.content.map((record) => (record.conceptId === "g1" ? { ...record, definition: "Group One, rewritten." } : record));
  assert.deepEqual(staleProblems(plan, edited, options), ["parent g1 changed"]);
  // s, reserved by this plan, is authored by its owner: the reservation is now its record.
  const authored = model([{ id: "s-content", conceptId: "s", definition: "Shared is authored." }]);
  assert.deepEqual(staleProblems(plan, authored, { registry: [...REGISTRY, "s"], hazards: HAZARDS }), ["s was authored since the plan"]);
  assert.deepEqual(staleProblems(plan, model(), { registry: REGISTRY, hazards: { ...HAZARDS, nearSynonyms: [] } }), ["the hazards touching the group changed"]);
  const moved = model();
  moved.placements = moved.placements.filter((placement) => placement.id !== "u-in-g1");
  assert.match(staleProblems(plan, moved, options).join(), /membership or ownership changed/);
});

test("across plans, a reservation must be claimed or revised by its owner, and no claim has two owners", () => {
  const inventory = inventoryL2(model(), { authoredContent: REGISTRY });
  assert.deepEqual(crossPlanProblems([filledG1(), filledG2()], inventory), []);
  // The owner's plan does not take up the reservation.
  const g2 = filledG2();
  g2.members.find((member) => member.conceptId === "s")!.claims = ["what shared things are"];
  assert.match(crossPlanProblems([filledG1(), g2], inventory).join(), /s: reserved by g1 as "what shared things share", but its owner's plan \(g2\) neither claims nor revises it/);
  // An explicit revision with a reason honours it.
  g2.members.find((member) => member.conceptId === "s")!.revisions = [{ claim: "What shared things share", reason: "narrowed to membership" }];
  assert.deepEqual(crossPlanProblems([filledG1(), g2], inventory), []);
  // One claim, two owners in different plans; a reservation owned by someone else.
  const clash = filledG2();
  clash.members.find((member) => member.conceptId === "t")!.claims = ["how alpha starts"];
  const problems = crossPlanProblems([filledG1(), clash], inventory).join("\n");
  assert.match(problems, /claim "how alpha starts" is owned by both a and t/);
  // Before the owner's plan exists, a reservation stands on its own.
  assert.deepEqual(crossPlanProblems([filledG1()], inventory), []);
});

test("mentions are the parent's sentences that name the concept, never its term strips", () => {
  const lines = ["Alphas come first. Betas follow them.", "[terms] Alpha · Beta", "Tango is apart. An alpha sees it."];
  assert.deepEqual(mentionsOf(lines, ["Alpha"]), ["Alphas come first.", "An alpha sees it."]);
  assert.deepEqual(mentionsOf(lines, ["Gamma"]), []);
});

test("the L2 context gives every placement, the parents' mentions, the territory and the hazards", () => {
  const context = assembleL2Context("a", model(), [filledG1()], options);
  assert.equal(context.owner?.group, "g1");
  assert.deepEqual(context.placements.map((placement) => [placement.placementId, placement.parentMentions]), [["a", ["Alphas come first."]]]);
  assert.deepEqual(context.domainMentions, [{ from: "d1", sentence: "Alpha matters here." }]);
  assert.deepEqual(context.plan, { group: "g1", claims: ["how alpha starts"], excludes: [], revisions: [] });
  assert.deepEqual(context.siblingTerritory.map((sibling) => sibling.conceptId), ["b", "s", "u"]);
  assert.deepEqual(context.hazards.pairs.map((pair) => pair.concepts), [["a", "t"]]);
  assert.deepEqual(context.authoredNeighbours, ["u"]);
  assert.deepEqual(assembleL2Context("s", model(), [filledG1()], options).reservedElsewhere, [{ group: "g1", claims: ["what shared things share"] }]);
  assert.equal(assembleL2Context("b", model(), [], options).hazards.stateCandidate, "strong");
  assert.match(formatL2Context(context), /claims \(explain only these\): how alpha starts/);
});

test("on the corpus, a multi-placement concept's context covers all five placements and its parents' claims", () => {
  const context = assembleL2Context("pause-mechanisms", mapKnowledge, []);
  assert.equal(context.placements.length, 5);
  assert.equal(context.owner?.group, "emergency-governance");
  assert.ok(context.placements[0].parentMentions.length > 0);
  assert.equal(context.hazards.stateCandidate, "strong");
  assert.deepEqual(planProblems(planSkeleton(mapKnowledge, "emergency-governance"), mapKnowledge).filter((problem) => !/needs at least one non-empty claim/.test(problem)), []);
});
