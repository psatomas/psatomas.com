import assert from "node:assert/strict";
import test from "node:test";
import { mapKnowledge, createMapResolver } from "../../lib/map/index.ts";
import type { MapKnowledgeModel } from "../../lib/map/index.ts";
import {
  buildMapExplorerView,
  getInitialExpandedPlacementIds,
  getVisibleMapExplorerRows,
} from "./explorer-model.ts";

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
