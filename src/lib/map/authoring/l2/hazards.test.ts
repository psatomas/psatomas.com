import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { mapKnowledge } from "../../data.ts";
import { inventoryL2 } from "./inventory.ts";

type Hazards = {
  nearSynonyms: { concepts: string[]; note: string }[];
  categoryMembers: { category: string; members: string[]; scope: string }[];
  multiAxisGroups: { group: string; axes: string[] }[];
  facetWatch: { concept: string; note: string }[];
  stateCandidates: { strong: string[]; moderate: string[] };
  verticalBoundary: { l1Concept: string; l2Territory: string[]; note: string }[];
};

const hazards: Hazards = JSON.parse(readFileSync(new URL("./hazards.json", import.meta.url), "utf8"));
const { concepts } = inventoryL2(mapKnowledge);
const l2 = new Set(concepts.map((facts) => facts.conceptId));
const concept = new Set(mapKnowledge.concepts.map((entry) => entry.id));
const placementDepth = (id: string) => {
  let depth = 0;
  let placement = mapKnowledge.placements.find((entry) => entry.id === id);
  if (!placement) return -1;
  while (placement.parentPlacementId) {
    depth++;
    placement = mapKnowledge.placements.find((entry) => entry.id === placement!.parentPlacementId)!;
  }
  return depth;
};

test("every hazard names L2 concepts that exist", () => {
  const named = [
    ...hazards.nearSynonyms.flatMap((pair) => pair.concepts),
    ...hazards.categoryMembers.flatMap((entry) => [entry.category, ...entry.members]),
    ...hazards.facetWatch.map((entry) => entry.concept),
    ...hazards.stateCandidates.strong,
    ...hazards.stateCandidates.moderate,
    ...hazards.verticalBoundary.flatMap((entry) => entry.l2Territory),
  ];
  assert.deepEqual(named.filter((id) => !l2.has(id)), []);
  assert.deepEqual(hazards.verticalBoundary.map((entry) => entry.l1Concept).filter((id) => !concept.has(id)), []);
});

test("hazard entries are well formed", () => {
  for (const { concepts: pair } of hazards.nearSynonyms) assert.ok(pair.length === 2 && pair[0] !== pair[1], pair.join(" ~ "));
  for (const { category, members } of hazards.categoryMembers) assert.ok(members.length > 0 && !members.includes(category), category);
  for (const { group, axes } of hazards.multiAxisGroups) assert.ok(placementDepth(group) === 1 && axes.length >= 2, group);
  const state = [...hazards.stateCandidates.strong, ...hazards.stateCandidates.moderate];
  assert.equal(new Set(state).size, state.length);
});
