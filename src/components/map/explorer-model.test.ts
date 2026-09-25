import assert from "node:assert/strict";
import test from "node:test";
import { mapKnowledge, createMapResolver } from "../../lib/map/index.ts";
import type { MapKnowledgeModel } from "../../lib/map/index.ts";
import {
  buildMapExplorerView,
  getInitialExpandedPlacementIds,
  getInitialMapExplorerState,
  getMapContextHref,
  getMapExplorerContext,
  getMapL0Entries,
  getNextMapContext,
  getVisibleMapExplorerRegions,
  getVisibleMapExplorerRows,
  indexMapExplorerView,
  resolveMapContextParam,
  revealMapExplorerContext,
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

// L0 domains that currently hold re-homed proof-fixture placements.
const POPULATED_L0 = {
  foundations: [
    "protocols",
    "distributed-systems",
    "state-machines",
    "trust-models",
    "coordination",
    "adversarial-environments",
    "protocol-properties",
  ],
  "consensus-ordering": ["consensus"],
  "identity-accounts-authority": ["identity", "authority"],
  "scaling-modular-systems": ["scaling"],
  "ai-intelligent-systems": ["ai-agent"],
} as const;

test("explorer resolves the 27 ordered L0 roots and their placement children", () => {
  assert.equal(view.roots.length, 27);
  assert.equal(view.roots[0].placementId, "foundations");
  assert.equal(view.roots[26].placementId, "frontier-systems");
  for (const root of view.roots) {
    const expected = POPULATED_L0[root.placementId as keyof typeof POPULATED_L0] ?? [];
    assert.deepEqual(root.children.map((child) => child.placementId), expected, root.placementId);
  }
});

test("empty L0 domains are leaves that never expose disclosure, even if marked expanded", () => {
  const everyRoot = new Set(view.roots.map((root) => root.placementId));
  const rows = getVisibleMapExplorerRows(view, everyRoot).filter((row) => row.depth === 0);
  const populated = Object.keys(POPULATED_L0);

  for (const row of rows) {
    const hasChildren = populated.includes(row.placementId);
    assert.equal(row.hasChildren, hasChildren, row.placementId);
    assert.equal(row.isExpanded, hasChildren, row.placementId);
  }
  assert.equal(rows.filter((row) => !row.hasChildren).length, 22);
});

test("Finality remains one concept rendered through two independent placements", () => {
  const rows = getVisibleMapExplorerRows(view, new Set([
    "consensus-ordering",
    "consensus",
    "scaling-modular-systems",
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
  const expanded = new Set(["consensus-ordering", "consensus", "scaling-modular-systems", "scaling", "rollups"]);
  assert.equal(getVisibleMapExplorerRows(view, expanded).filter((row) => row.conceptId === "finality").length, 2);

  expanded.delete("consensus-ordering");
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
  assert.deepEqual(getInitialExpandedPlacementIds(view), [
    "foundations",
    "consensus-ordering",
    "identity-accounts-authority",
    "scaling-modular-systems",
    "ai-intelligent-systems",
  ]);
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

test("disclosure only changes the expanded set, so several branches stay open and context is untouched", () => {
  const initial = getInitialMapExplorerState(view, "finality-in-rollups");
  let expanded = toggleMapExplorerPlacement(initial.expandedPlacementIds, "consensus");
  expanded = toggleMapExplorerPlacement(expanded, "foundations");
  expanded = toggleMapExplorerPlacement(expanded, "foundations");

  // Disclosure is a Set-to-Set change; the context (URL-owned) has no input or output here.
  assert.ok(expanded.has("consensus") && expanded.has("rollups") && expanded.has("ai-intelligent-systems"));
  assert.equal(getMapContextHref(initial.focusedPlacementId), "/map?context=finality-in-rollups");
});

test("a context change reveals only its ancestors and never closes a branch", () => {
  const index = indexMapExplorerView(view);
  const open = new Set(["foundations", "ai-intelligent-systems", "consensus-ordering"]);

  const revealed = revealMapExplorerContext(open, index, "finality-in-rollups");
  assert.deepEqual([...revealed].sort(), [...open, "scaling-modular-systems", "scaling", "rollups"].sort());
  // Already-visible context: nothing changes (same set instance).
  assert.equal(revealMapExplorerContext(revealed, index, "rollups"), revealed);
  // Clearing context reveals nothing and closes nothing.
  assert.equal(revealMapExplorerContext(open, index, null), open);
});

test("selecting the active placement clears context; anything else moves to it", () => {
  assert.equal(getNextMapContext(null, "consensus"), "consensus");
  assert.equal(getNextMapContext("consensus", "finality-in-consensus"), "finality-in-consensus");
  assert.equal(getNextMapContext("consensus", "consensus"), null);
});

test("context navigation URLs carry placement identity only; clearing returns to /map", () => {
  assert.equal(getMapContextHref("consensus-ordering"), "/map?context=consensus-ordering");
  assert.equal(getMapContextHref("finality-in-consensus"), "/map?context=finality-in-consensus");
  assert.equal(getMapContextHref(null), "/map");
  assert.equal(getMapContextHref("a b&c"), "/map?context=a+b%26c");
});

test("the URL context value is validated against placements in the view", () => {
  const index = indexMapExplorerView(view);
  assert.equal(resolveMapContextParam(index, ["finality-in-consensus"]), "finality-in-consensus");
  assert.equal(resolveMapContextParam(index, "machine-economy"), "machine-economy");
  for (const invalid of [[], [""], ["nope"], ["finality"], ["consensus", "rollups"], ["<script>"], null, undefined]) {
    assert.equal(resolveMapContextParam(index, invalid), null, JSON.stringify(invalid));
  }
});

test("every L0 placement is a valid context, empty or populated", () => {
  const index = indexMapExplorerView(view);
  for (const root of view.roots) {
    const state = getInitialMapExplorerState(view, root.placementId);
    assert.equal(state.focusedPlacementId, root.placementId);
    assert.deepEqual(getMapExplorerContext(index, root.placementId).map((step) => step.placementId), [root.placementId]);
    // Populated roots are open; empty roots gain no disclosure state.
    assert.equal(state.expandedPlacementIds.has(root.placementId), root.children.length > 0);
  }
});

test("homepage L0 entries derive from canonical root placements: 27, ordered, linked", () => {
  const entries = getMapL0Entries(resolver);
  const roots = resolver.getRootPlacements();

  assert.equal(entries.length, 27);
  assert.deepEqual(entries.map((entry) => entry.placementId), roots.map((placement) => placement.id));
  assert.deepEqual(entries.map((entry) => entry.ordinal), Array.from({ length: 27 }, (_, i) => String(i + 1).padStart(2, "0")));
  for (const entry of entries) {
    assert.ok(resolver.getPlacement(entry.placementId));
    assert.equal(entry.label, resolver.getConcept(entry.conceptId)?.title);
    assert.equal(entry.href, `/map?context=${entry.placementId}`);
  }
  assert.equal(entries[0].href, "/map?context=foundations");
  assert.equal(entries[26].href, "/map?context=frontier-systems");
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

  assert.deepEqual(inConsensus.map((step) => step.label), ["Consensus & Ordering", "Consensus", "Finality"]);
  assert.deepEqual(inRollups.map((step) => step.label), ["Scaling & Modular Systems", "Scaling", "Rollups", "Finality"]);
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
  const regions = getVisibleMapExplorerRegions(view, new Set(["foundations", "consensus-ordering", "consensus"]));

  assert.deepEqual(regions.map((region) => region.header.placementId), view.roots.map((root) => root.placementId));
  assert.deepEqual(regions[0].rows.map((row) => row.placementId), POPULATED_L0.foundations);
  assert.ok(regions[0].rows.every((row) => row.parentLabel === "Foundations"));
  assert.deepEqual(regions[3].rows.map((row) => [row.placementId, row.parentLabel]), [
    ["consensus", "Consensus & Ordering"],
    ["finality-in-consensus", "Consensus"],
  ]);
  // A collapsed region keeps its identity but exposes no rows; an empty one has none.
  assert.deepEqual(regions[14].rows, []);
  assert.equal(regions[14].header.hasChildren, true);
  assert.deepEqual(regions[1].rows, []);
  assert.equal(regions[1].header.hasChildren, false);
});

test("no entry context yields exactly the default initial state", () => {
  const state = getInitialMapExplorerState(view);
  assert.deepEqual([...state.expandedPlacementIds], getInitialExpandedPlacementIds(view));
  assert.equal(state.focusedPlacementId, null);
  assert.deepEqual(getInitialMapExplorerState(view, null), state);
});

test("an entry context opens its region and itself, focuses it, and expands nothing deeper", () => {
  const state = getInitialMapExplorerState(view, "consensus");
  assert.equal(state.focusedPlacementId, "consensus");
  assert.ok(state.expandedPlacementIds.has("consensus-ordering"));
  assert.ok(state.expandedPlacementIds.has("consensus"));

  const visible = getVisibleMapExplorerRows(view, state.expandedPlacementIds).map((row) => row.placementId);
  assert.ok(visible.includes("finality-in-consensus"));
  // Independent branches keep their default disclosure; other Finality stays hidden.
  assert.ok(!visible.includes("finality-in-rollups"));
  assert.ok(visible.includes("scaling"));
  assert.ok(!visible.includes("rollups"));
});

test("an entry context reveals its ancestry at arbitrary depth without opening its subtree", () => {
  const deepResolver = createMapResolver(chainModel(12));
  const deepView = buildMapExplorerView(deepResolver, rootPlacementIds(deepResolver));
  const state = getInitialMapExplorerState(deepView, "level-6");
  const visible = getVisibleMapExplorerRows(deepView, state.expandedPlacementIds).map((row) => row.placementId);

  assert.equal(state.focusedPlacementId, "level-6");
  assert.deepEqual(visible, Array.from({ length: 8 }, (_, i) => `level-${i}`));
});

test("an entry context at a leaf placement reveals that placement, not its sibling contexts", () => {
  const state = getInitialMapExplorerState(view, "finality-in-rollups");
  const rows = getVisibleMapExplorerRows(view, state.expandedPlacementIds);
  assert.deepEqual(rows.filter((row) => row.conceptId === "finality").map((row) => row.placementId), [
    "finality-in-rollups",
  ]);
  assert.ok(!state.expandedPlacementIds.has("finality-in-rollups"));
});

test("an unknown entry context is ignored rather than breaking the explorer", () => {
  for (const context of ["unknown-placement", "", "finality"]) {
    assert.deepEqual(getInitialMapExplorerState(view, context), getInitialMapExplorerState(view));
  }
});

test("an L0 entry context focuses the domain; an empty domain adds no disclosure state", () => {
  const populated = getInitialMapExplorerState(view, "scaling-modular-systems");
  assert.equal(populated.focusedPlacementId, "scaling-modular-systems");
  assert.deepEqual([...populated.expandedPlacementIds], getInitialExpandedPlacementIds(view));

  const empty = getInitialMapExplorerState(view, "state-data");
  assert.equal(empty.focusedPlacementId, "state-data");
  assert.deepEqual([...empty.expandedPlacementIds], getInitialExpandedPlacementIds(view));
});

test("a deep entry context reveals its full ancestor chain from the L0 domain", () => {
  const state = getInitialMapExplorerState(view, "finality-in-rollups");
  for (const id of ["scaling-modular-systems", "scaling", "rollups"]) assert.ok(state.expandedPlacementIds.has(id), id);
  assert.deepEqual(
    getMapExplorerContext(indexMapExplorerView(view), state.focusedPlacementId).map((step) => step.placementId),
    ["scaling-modular-systems", "scaling", "rollups", "finality-in-rollups"],
  );
});

test("L0 rows carry ordinals 01 → 27 from the canonical root order; nested rows carry none", () => {
  const everyPlacement = new Set(mapKnowledge.placements.map((placement) => placement.id));
  const rows = getVisibleMapExplorerRows(view, everyPlacement);
  const roots = rows.filter((row) => row.depth === 0);

  assert.deepEqual(roots.map((row) => row.ordinal), Array.from({ length: 27 }, (_, i) => String(i + 1).padStart(2, "0")));
  assert.deepEqual(roots.map((row) => row.placementId), resolver.getRootPlacements().map((placement) => placement.id));
  assert.ok(rows.some((row) => row.depth > 0));
  assert.deepEqual(rows.filter((row) => row.depth > 0).map((row) => row.ordinal), rows.filter((row) => row.depth > 0).map(() => undefined));
  // Ordinals are presentation only: identities and labels stay unnumbered.
  assert.ok(roots.every((row) => !/\d/.test(row.placementId + row.conceptId + row.label)));
});

test("a bounded view of some roots keeps each domain's canonical ordinal", () => {
  const bounded = buildMapExplorerView(resolver, ["state-data", "frontier-systems"]);
  assert.deepEqual(bounded.roots.map((root) => root.ordinal), ["03", "27"]);
});
