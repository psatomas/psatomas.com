import assert from "node:assert/strict";
import test from "node:test";
import { mapKnowledge } from "../../data.ts";
import type { MapKnowledgeModel } from "../../types.ts";
import { inventoryL2 } from "./inventory.ts";

/**
 * Two domains. g1 (Domain One) holds a, b (labelled "Tango", the title of t)
 * and a second placement of s. g2 (Domain Two) holds s (its preferred
 * placement), t, and a placement of g1, which makes g1 dual-role.
 */
function model({ unpreferred = false, deep = false } = {}): MapKnowledgeModel {
  const titles: Record<string, string> = { d1: "Domain One", d2: "Domain Two", g1: "Group One", g2: "Group Two", a: "Alpha", b: "Beta", s: "Shared", t: "Tango", z: "Zulu" };
  const placements = [
    { id: "d1", conceptId: "d1", order: 0 },
    { id: "d2", conceptId: "d2", order: 1 },
    { id: "g1", conceptId: "g1", parentPlacementId: "d1", order: 0 },
    { id: "g2", conceptId: "g2", parentPlacementId: "d2", order: 0 },
    { id: "a", conceptId: "a", parentPlacementId: "g1", order: 0 },
    { id: "b", conceptId: "b", parentPlacementId: "g1", order: 1, contextualLabel: "Tango" },
    { id: "s-in-g1", conceptId: "s", parentPlacementId: "g1", order: 2 },
    { id: "s", conceptId: "s", parentPlacementId: "g2", order: 0 },
    { id: "t", conceptId: "t", parentPlacementId: "g2", order: 1 },
    { id: "g1-in-g2", conceptId: "g1", parentPlacementId: "g2", order: 2 },
    ...(deep ? [{ id: "z", conceptId: "z", parentPlacementId: "a", order: 0 }] : []),
  ];
  return {
    concepts: Object.entries(titles).map(([id, title]) => ({ id, slug: id, title, ...(id === "s" && !unpreferred ? { preferredPlacementId: "s" } : {}), ...(id === "g1" ? { preferredPlacementId: "g1" } : {}) })),
    placements,
    relationships: [],
    content: [{ id: "g1-content", conceptId: "g1", definition: "Group One is a group." }],
    mechanisms: [],
    knowledgePaths: [],
  };
}

const inventory = (options?: Parameters<typeof model>[0]) => inventoryL2(model(options), { authoredContent: ["g1"] });

test("L2 facts keep concept identity apart from placement identity", () => {
  const { counts, concepts, problems } = inventory();
  assert.deepEqual(problems, []);
  assert.equal(counts.placements, 6);
  assert.equal(counts.concepts, 5);
  assert.equal(counts.l2Only, 4);
  assert.equal(counts.dualRole, 1);
  assert.equal(counts.dualRolePlacements, 1);
  assert.equal(counts.multiPlacement, 2);
  assert.equal(counts.crossDomain, 2);
  assert.equal(counts.withContent, 1);
  const shared = concepts.find((facts) => facts.conceptId === "s")!;
  assert.deepEqual(shared.placements.map((placement) => placement.placementId), ["s-in-g1", "s"]);
  assert.equal(shared.groups, 2);
  assert.equal(shared.domains, 2);
});

test("an l2-only concept is owned at its preferred placement; a dual-role concept has no L2 owner", () => {
  const { concepts } = inventory();
  assert.deepEqual(concepts.find((facts) => facts.conceptId === "s")!.owner, { placementId: "s", groupPlacementId: "g2", domainPlacementId: "d2" });
  assert.deepEqual(concepts.find((facts) => facts.conceptId === "a")!.owner, { placementId: "a", groupPlacementId: "g1", domainPlacementId: "d1" });
  const dual = concepts.find((facts) => facts.conceptId === "g1")!;
  assert.equal(dual.role, "dual-role");
  assert.equal(dual.owner, undefined);
  assert.equal(dual.hasContent && dual.registered, true);
});

test("each group records the standing of every member and the groups that share concepts are linked", () => {
  const { groups, counts, linkedGroupSets } = inventory();
  const standing = (id: string) => groups.find((group) => group.groupPlacementId === id)!.members.map((member) => [member.conceptId, member.standing]);
  assert.deepEqual(standing("g1"), [["a", "owned"], ["b", "owned"], ["s", "owned-elsewhere"]]);
  assert.deepEqual(standing("g2"), [["s", "owned"], ["t", "owned"], ["g1", "dual-role"]]);
  assert.equal(counts.groups, 2);
  assert.equal(counts.ownershipGroups, 2);
  assert.deepEqual(linkedGroupSets, [2]);
});

test("a contextual label that is another concept's title is reported as a homonym", () => {
  assert.deepEqual(inventory().concepts.find((facts) => facts.conceptId === "b")!.labelHomonyms, ["t"]);
});

test("topology the architecture does not handle is reported, not guessed", () => {
  assert.deepEqual(inventory({ unpreferred: true }).problems, ["s has 2 placements but no preferred L2 placement: ownership is unclear"]);
  assert.deepEqual(inventory({ deep: true }).problems, ["z is deeper than L2", "L2 placement a carries children"]);
});

test("the corpus meets the L2 architecture's preconditions", () => {
  const { problems, counts, groups } = inventoryL2(mapKnowledge);
  // Every L2 placement is a leaf, every l2-only concept has one owner, and content matches the registry.
  assert.deepEqual(problems, []);
  assert.equal(counts.concepts, counts.l2Only + counts.dualRole);
  // Every member of every group is accounted for exactly once.
  assert.equal(groups.reduce((sum, group) => sum + group.members.length, 0), counts.placements);
});
