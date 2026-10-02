import assert from "node:assert/strict";
import test from "node:test";
import { mapKnowledge } from "../../data.ts";
import { assembleL2Context, formatL2Context, mentionsOf } from "./context.ts";
import { filledG1, filledG2, HAZARDS, model, options, REGISTRY } from "./fixtures.ts";
import { inventoryL2 } from "./inventory.ts";
import { crossPlanProblems, planProblems, planSkeleton, staleProblems } from "./territory.ts";

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
