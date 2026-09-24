import assert from "node:assert/strict";
import test from "node:test";
import { mapKnowledge, createMapResolver } from "../../lib/map/index.ts";
import type { MapKnowledgeModel } from "../../lib/map/index.ts";
import {
  buildMapExplorerView,
  focusMapExplorerPlacement,
  getInitialExpandedPlacementIds,
  getInitialMapExplorerState,
  getMapExplorerContext,
  getVisibleMapExplorerRegions,
  getVisibleMapExplorerRows,
  indexMapExplorerView,
  toggleMapExplorerPlacement,
} from "./explorer-model.ts";

function chainModel(depth: number): MapKnowledgeModel {
  const concepts = Array.from({ length: depth }, (_, index) => ({
    id: `level-${index}`,
    slug: `level-${index}`,
    title: `Level ${index}`,
  }));
  return {
    concepts,
    placements: concepts.map((concept, index) => ({
      id: concept.id,
      conceptId: concept.id,
      parentPlacementId: index === 0 ? undefined : `level-${index - 1}`,
      order: 0,
    })),
    relationships: [],
    content: [],
    mechanisms: [],
    knowledgePaths: [],
  };
}

function rootPlacementIds(resolver: ReturnType<typeof createMapResolver>): string[] {
  return resolver.getRootPlacements().map((placement) => placement.id);
}

const resolver = createMapResolver(mapKnowledge);
const view = buildMapExplorerView(resolver, rootPlacementIds(resolver));

test("explorer resolves ordered roots and placement children from the MAP domain", () => {
  assert.deepEqual(view.roots.map((root) => root.placementId), [
    "distributed-systems",
    "scaling",
    "identity",
    "authority",
    "ai-agent",
  ]);
  assert.deepEqual(view.roots[0].children.map((child) => child.placementId), ["consensus"]);
  assert.deepEqual(view.roots[1].children.map((child) => child.placementId), ["rollups"]);
});

test("Finality remains one concept rendered through two independent placements", () => {
  const rows = getVisibleMapExplorerRows(view, new Set([
    "distributed-systems",
    "consensus",
    "scaling",
    "rollups",
  ]));
  const finalityRows = rows.filter((row) => row.conceptId === "finality");

  assert.deepEqual(finalityRows.map((row) => row.placementId), [
    "finality-in-consensus",
    "finality-in-rollups",
  ]);
  assert.deepEqual(finalityRows.map((row) => row.label), ["Finality", "Finality"]);
});

test("collapsed branches hide descendants while independent branches coexist", () => {
  const expanded = new Set(["distributed-systems", "consensus", "scaling", "rollups"]);
  assert.equal(getVisibleMapExplorerRows(view, expanded).filter((row) => row.conceptId === "finality").length, 2);

  expanded.delete("distributed-systems");
  const rows = getVisibleMapExplorerRows(view, expanded);
  assert.deepEqual(rows.filter((row) => row.conceptId === "finality").map((row) => row.placementId), [
    "finality-in-rollups",
  ]);
  assert.equal(rows.find((row) => row.placementId === "consensus"), undefined);
});

test("expansion is keyed by placement, so one multi-placed concept opens per context", () => {
  const model: MapKnowledgeModel = {
    concepts: ["region-a", "region-b", "shared", "detail"].map((id) => ({ id, slug: id, title: id })),
    placements: [
      { id: "region-a", conceptId: "region-a", order: 0 },
      { id: "region-b", conceptId: "region-b", order: 1 },
      { id: "shared-in-a", conceptId: "shared", parentPlacementId: "region-a", order: 0 },
      { id: "shared-in-b", conceptId: "shared", parentPlacementId: "region-b", order: 0 },
      { id: "detail-in-a", conceptId: "detail", parentPlacementId: "shared-in-a", order: 0 },
      { id: "detail-in-b", conceptId: "detail", parentPlacementId: "shared-in-b", order: 0 },
    ],
    relationships: [],
    content: [],
    mechanisms: [],
    knowledgePaths: [],
  };
  const sharedResolver = createMapResolver(model);
  const sharedView = buildMapExplorerView(sharedResolver, rootPlacementIds(sharedResolver));
  const visible = (expanded: string[]) =>
    getVisibleMapExplorerRows(sharedView, new Set(expanded)).map((row) => row.placementId);

  assert.deepEqual(visible(["region-a", "region-b", "shared-in-a"]), [
    "region-a",
    "shared-in-a",
    "detail-in-a",
    "region-b",
    "shared-in-b",
  ]);
  // Collapsing an ancestor hides the branch but retains its descendant state for reopening.
  assert.deepEqual(visible(["region-b", "shared-in-a"]), ["region-a", "region-b", "shared-in-b"]);
});

test("root regions are initially open while descendant branches remain reader-controlled", () => {
  assert.deepEqual(getInitialExpandedPlacementIds(view), ["distributed-systems", "scaling", "identity"]);
});

test("recursive projection supports synthetic deep hierarchies without a depth limit", () => {
  const depth = 12;
  const concepts = Array.from({ length: depth }, (_, index) => ({
    id: `level-${index}`,
    slug: `level-${index}`,
    title: `Level ${index}`,
  }));
  const placements = concepts.map((concept, index) => ({
    id: concept.id,
    conceptId: concept.id,
    parentPlacementId: index === 0 ? undefined : `level-${index - 1}`,
    order: 0,
  }));
  const model: MapKnowledgeModel = {
    concepts,
    placements,
    relationships: [],
    content: [],
    mechanisms: [],
    knowledgePaths: [],
  };
  const deepResolver = createMapResolver(model);
  const deepView = buildMapExplorerView(deepResolver, rootPlacementIds(deepResolver));
  const rows = getVisibleMapExplorerRows(deepView, new Set(placements.map((placement) => placement.id)));

  assert.equal(rows.length, depth);
  assert.deepEqual(rows.map((row) => row.depth), Array.from({ length: depth }, (_, index) => index));
  assert.ok(rows.every((row) => typeof row.depth === "number"));
});

test("disclosure never implicitly focuses, and several branches stay open", () => {
  let state = getInitialMapExplorerState(view);
  assert.equal(state.focusedPlacementId, null);

  state = toggleMapExplorerPlacement(state, "consensus");
  state = toggleMapExplorerPlacement(state, "rollups");
  assert.equal(state.focusedPlacementId, null);
  assert.deepEqual([...state.expandedPlacementIds].sort(), [
    "consensus",
    "distributed-systems",
    "identity",
    "rollups",
    "scaling",
  ]);

  // Disclosure also leaves an existing context untouched.
  state = focusMapExplorerPlacement(state, "finality-in-rollups");
  state = toggleMapExplorerPlacement(state, "consensus");
  assert.equal(state.focusedPlacementId, "finality-in-rollups");
});

test("focusing a placement never opens or closes branches", () => {
  let state = getInitialMapExplorerState(view);
  state = toggleMapExplorerPlacement(state, "consensus");
  state = toggleMapExplorerPlacement(state, "rollups");
  const expandedBefore = [...state.expandedPlacementIds];

  state = focusMapExplorerPlacement(state, "finality-in-consensus");
  assert.deepEqual([...state.expandedPlacementIds], expandedBefore);
  state = focusMapExplorerPlacement(state, null);
  assert.equal(state.focusedPlacementId, null);
  assert.deepEqual([...state.expandedPlacementIds], expandedBefore);
});

test("context ancestry is placement-derived and matches resolver ancestry", () => {
  const index = indexMapExplorerView(view);
  for (const placement of mapKnowledge.placements) {
    const expected = [...resolver.getAncestors(placement.id), placement].map((entry) => entry.id);
    assert.deepEqual(getMapExplorerContext(index, placement.id).map((step) => step.placementId), expected);
  }
  assert.deepEqual(getMapExplorerContext(index, null), []);
  assert.deepEqual(getMapExplorerContext(index, "unknown-placement"), []);
});

test("the two Finality placements produce distinct contexts for one canonical concept", () => {
  const index = indexMapExplorerView(view);
  const inConsensus = getMapExplorerContext(index, "finality-in-consensus");
  const inRollups = getMapExplorerContext(index, "finality-in-rollups");

  assert.deepEqual(inConsensus.map((step) => step.label), ["Distributed Systems", "Consensus", "Finality"]);
  assert.deepEqual(inRollups.map((step) => step.label), ["Scaling", "Rollups", "Finality"]);
  assert.equal(inConsensus.at(-1)?.conceptId, "finality");
  assert.equal(inRollups.at(-1)?.conceptId, "finality");
  assert.notEqual(inConsensus.at(-1)?.placementId, inRollups.at(-1)?.placementId);
});

test("context ancestry supports arbitrary depth", () => {
  const depth = 12;
  const deepResolver = createMapResolver(chainModel(depth));
  const deepView = buildMapExplorerView(deepResolver, rootPlacementIds(deepResolver));
  const context = getMapExplorerContext(indexMapExplorerView(deepView), `level-${depth - 1}`);

  assert.deepEqual(context.map((step) => step.placementId), Array.from({ length: depth }, (_, i) => `level-${i}`));
});

test("root placements become structural regions holding their visible descendants", () => {
  const regions = getVisibleMapExplorerRegions(view, new Set(["distributed-systems", "consensus", "identity"]));

  assert.deepEqual(regions.map((region) => region.header.placementId), [
    "distributed-systems",
    "scaling",
    "identity",
    "authority",
    "ai-agent",
  ]);
  assert.deepEqual(regions[0].rows.map((row) => [row.placementId, row.parentLabel]), [
    ["consensus", "Distributed Systems"],
    ["finality-in-consensus", "Consensus"],
  ]);
  // A collapsed region keeps its identity but exposes no rows.
  assert.deepEqual(regions[1].rows, []);
});
