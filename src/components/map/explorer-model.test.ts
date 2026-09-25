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
  getMapConceptContentHref,
  getVisibleMapExplorerRegions,
  getVisibleMapExplorerRows,
  activateMapExplorerRow,
  enterMapExplorerContext,
  getContainingMapL0,
  getContainingMapL0Ordinal,
  getMapL0IndexEntries,
  indexMapExplorerView,
  resolveMapContextParam,
  revealMapExplorerContext,
  toggleMapExplorerPlacement,
  toMapConceptExposition,
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
  "computation-execution": [
    "execution-models",
    "transactions",
    "virtual-machines",
    "smart-contracts",
    "verifiable-computation",
    "off-chain-computation",
    "resource-accounting",
  ],
  "state-data": [
    "state-representation",
    "transitions-in-state-data",
    "state-commitments",
    "historical-state",
    "synchronization",
    "on-chain-data",
    "off-chain-data",
    "data-integrity",
    "provenance",
    "indexing",
  ],
  "consensus-ordering": [
    "consensus",
    "validators",
    "fork-choice",
    "finality-in-consensus",
    "mempools",
    "sequencing",
    "block-building",
    "proposer-builder-separation",
    "preconfirmations",
    "censorship-resistance-in-consensus-ordering",
  ],
  "networks-infrastructure": [
    "p2p-networks",
    "message-propagation",
    "nodes",
    "rpc",
    "indexers",
    "relayers",
    "keepers",
    "bots",
    "monitoring",
    "automation",
  ],
  "cryptography-proofs": [
    "hash-functions",
    "digital-signatures",
    "cryptographic-commitments",
    "threshold-cryptography",
    "zero-knowledge-proofs",
    "proof-systems",
    "verifiable-computation-in-cryptography-proofs",
    "privacy",
  ],
  "storage-availability": [
    "on-chain-storage",
    "distributed-storage",
    "content-addressing-in-storage-availability",
    "archival-storage",
    "data-availability",
    "erasure-coding",
    "blobs",
    "data-availability-sampling",
    "storage-proofs",
  ],
  "protocol-design-lifecycle": [
    "protocol-requirements",
    "design-goals-constraints",
    "protocol-specification",
    "protocol-modeling",
    "prototyping-simulation",
    "protocol-implementation",
    "pre-launch-validation",
    "deployment-launch",
    "parameterization",
    "protocol-operations",
    "change-management",
    "versioning-compatibility",
    "protocol-evolution",
    "deprecation-retirement",
  ],
  "protocol-architecture": [
    "architectural-principles",
    "protocol-layers",
    "components-interfaces",
    "state-architecture",
    "execution-architecture",
    "contract-architecture",
    "client-architecture",
    "network-architecture",
    "data-architecture",
    "trust-architecture",
    "composability",
    "architectural-tradeoffs",
  ],
  "security-correctness-resilience": [
    "security-models",
    "security-properties",
    "threat-modeling",
    "attack-classes",
    "vulnerabilities-exploits",
    "smart-contract-security",
    "protocol-security",
    "correctness",
    "formal-methods",
    "testing",
    "auditing",
    "access-control",
    "key-security",
    "operational-security",
    "security-monitoring",
    "incident-response-in-security-correctness-resilience",
    "resilience",
    "security-economics",
    "upgrade-security",
    "domain-specific-security",
  ],
  "interoperability-abstraction": [
    "interoperability-models",
    "cross-chain-messaging",
    "bridges",
    "asset-bridging",
    "cross-chain-state",
    "cross-chain-verification",
    "interoperability-protocols",
    "cross-domain-execution-in-interoperability-abstraction",
    "cross-domain-settlement-in-interoperability-abstraction",
    "cross-domain-atomicity-in-interoperability-abstraction",
    "chain-abstraction",
    "abstraction-layers",
    "interoperability-security",
    "trust-failure-modes",
  ],
  "governance-institutions": [
    "governance-models",
    "governance-participants",
    "proposals",
    "voting",
    "representation",
    "decision-rules",
    "governance-execution",
    "councils-committees",
    "treasury-governance",
    "constitutional-rules",
    "checks-balances",
    "dispute-resolution",
    "emergency-governance",
    "governance-attacks",
    "institutional-design",
  ],
  "intents-coordination": [
    "intents",
    "intent-specification",
    "intent-discovery",
    "solvers",
    "solver-competition",
    "intent-matching",
    "intent-resolution",
    "execution-routing",
    "intent-commitments",
    "intent-settlement",
    "multi-party-coordination",
    "cross-domain-coordination",
  ],
  "mev-execution-markets": [
    "mev",
    "searchers",
    "arbitrage",
    "liquidation-mev",
    "sandwiching",
    "transaction-ordering-in-mev-execution-markets",
    "bundles",
    "builders-in-mev-execution-markets",
    "blockspace-markets",
    "order-flow",
    "mev-auctions",
    "private-execution",
    "mev-mitigation",
  ],
  "markets-financial-protocols": [
    "assets",
    "markets",
    "liquidity",
    "automated-market-makers",
    "order-books",
    "lending-borrowing",
    "collateral",
    "liquidations",
    "stablecoins",
    "derivatives",
    "risk",
    "solvency",
  ],
  "economics-mechanism-design": [
    "incentives",
    "mechanism-design",
    "game-theory",
    "strategic-behavior-in-economics-mechanism-design",
    "token-economics",
    "fees",
    "auctions",
    "resource-allocation",
    "staking-economics",
    "security-budgets",
    "cryptoeconomic-security",
  ],
  "oracles-external-reality": [
    "oracle-problem",
    "data-sources",
    "oracle-networks",
    "push-pull-oracles",
    "oracle-aggregation",
    "freshness",
    "provenance-in-oracles-external-reality",
    "oracle-security",
    "machine-readable-reality",
    "sensors-external-systems",
    "ai-interpreted-data",
    "real-world-attestations",
  ],
  "identity-accounts-authority": [
    "identity",
    "accounts",
    "wallets",
    "smart-accounts",
    "account-abstraction",
    "authentication",
    "authority",
    "machine-identity",
  ],
  "scaling-modular-systems": [
    "scaling",
    "rollups",
    "optimistic-rollups",
    "zk-rollups",
    "off-chain-scaling",
    "modularity",
    "execution-layers",
    "settlement-layers",
    "data-availability-layers",
    "consensus-layers",
    "rollup-sequencing",
    "batching-compression",
    "scaling-tradeoffs",
    "rollup-security",
  ],
  "ai-intelligent-systems": [
    "ai-models",
    "ai-inference-in-ai-intelligent-systems",
    "reasoning",
    "goals-planning",
    "memory-context",
    "tool-use",
    "ai-agent",
    "uncertainty-reliability",
    "ai-evaluation",
    "alignment-control",
    "ai-security",
    "verifiable-ai",
  ],
  "machine-economy": [
    "economic-agents",
    "agent-ownership",
    "agent-identity-in-machine-economy",
    "agent-wallets",
    "agent-capital",
    "agent-budgets",
    "agent-permissions",
    "machine-payments",
    "machine-commerce",
    "agent-markets",
    "agent-reputation-in-machine-economy",
    "agent-credit",
    "agent-risk",
    "agent-incentives",
  ],
  "autonomous-coordination": [
    "agent-to-agent-communication",
    "agent-discovery",
    "negotiation-in-autonomous-coordination",
    "delegation-in-autonomous-coordination",
    "cooperation-in-autonomous-coordination",
    "competition-in-autonomous-coordination",
    "coalition-formation",
    "resource-allocation-in-autonomous-coordination",
    "task-markets",
    "multi-agent-coordination",
  ],
  "autonomous-execution": [
    "objectives-intents",
    "execution-planning",
    "action-selection",
    "simulation",
    "execution-policies",
    "execution-authorization",
    "execution-environments",
    "action-execution",
    "verification-settlement",
    "execution-monitoring",
    "execution-recovery",
  ],
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
  assert.equal(rows.filter((row) => !row.hasChildren).length, 4);
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

test("domains begin collapsed: the initial view is the 27 domain identities only", () => {
  assert.deepEqual(getInitialExpandedPlacementIds(), []);
  const rows = getVisibleMapExplorerRows(view, new Set(getInitialExpandedPlacementIds()));
  assert.equal(rows.length, 27);
  assert.ok(rows.every((row) => row.depth === 0 && !row.isExpanded));
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
  assert.ok(expanded.has("consensus") && expanded.has("rollups") && expanded.has("scaling-modular-systems"));
  assert.ok(!expanded.has("foundations"));
  assert.equal(getMapContextHref(initial.focusedPlacementId), "/map?context=finality-in-rollups");
});

test("a context change reveals only its ancestors and never closes a branch", () => {
  const index = indexMapExplorerView(view);
  const open = new Set(["foundations", "ai-intelligent-systems", "consensus-ordering"]);

  const revealed = revealMapExplorerContext(open, index, "finality-in-rollups");
  assert.deepEqual([...revealed].sort(), [...open, "scaling-modular-systems", "rollups"].sort());
  // Already-visible context: nothing changes (same set instance).
  assert.equal(revealMapExplorerContext(revealed, index, "rollups"), revealed);
  // Clearing context reveals nothing and closes nothing.
  assert.equal(revealMapExplorerContext(open, index, null), open);
});

test("row activation: a closed row becomes the context and opens", () => {
  const foundations = getVisibleMapExplorerRows(view, new Set()).find((row) => row.placementId === "foundations")!;
  const result = activateMapExplorerRow(foundations, "state-data", new Set());
  assert.equal(result.contextPlacementId, "foundations");
  assert.deepEqual([...result.expandedPlacementIds], ["foundations"]);
  assert.equal(result.reveal, true);
});

test("row activation: a closed active row stays the context and opens", () => {
  const foundations = getVisibleMapExplorerRows(view, new Set()).find((row) => row.placementId === "foundations")!;
  const result = activateMapExplorerRow(foundations, "foundations", new Set());
  assert.equal(result.contextPlacementId, "foundations");
  assert.ok(result.expandedPlacementIds.has("foundations"));
  assert.equal(result.reveal, true);
});

test("row activation: an open active row collapses and keeps context, with nothing to reveal", () => {
  const open = new Set(["foundations"]);
  const foundations = getVisibleMapExplorerRows(view, open).find((row) => row.placementId === "foundations")!;
  const result = activateMapExplorerRow(foundations, "foundations", open);
  assert.equal(result.contextPlacementId, "foundations");
  assert.deepEqual([...result.expandedPlacementIds], []);
  assert.equal(result.reveal, false);
});

test("row activation: an open non-active row collapses without taking the context", () => {
  const open = new Set(["foundations", "scaling-modular-systems"]);
  const scaling = getVisibleMapExplorerRows(view, open).find((row) => row.placementId === "scaling-modular-systems")!;
  const result = activateMapExplorerRow(scaling, "foundations", open);
  assert.equal(result.contextPlacementId, "foundations");
  assert.deepEqual([...result.expandedPlacementIds], ["foundations"]);
  assert.equal(result.reveal, false);
});

test("row activation: a leaf becomes the context without fabricated disclosure", () => {
  const open = new Set(["foundations", "protocols"]);
  const rules = getVisibleMapExplorerRows(view, open).find((row) => row.placementId === "rules")!;
  assert.equal(rules.isExpandable, false);
  const result = activateMapExplorerRow(rules, "protocols", open);
  assert.equal(result.contextPlacementId, "rules");
  assert.equal(result.expandedPlacementIds, open);
  assert.equal(result.reveal, true);
  // An empty domain is a leaf too.
  const machineEconomy = getVisibleMapExplorerRows(view, new Set()).find((row) => row.placementId === "autonomous-organizations")!;
  assert.equal(activateMapExplorerRow(machineEconomy, null, new Set()).expandedPlacementIds.size, 0);
});

test("context navigation opens the placement and its ancestors; disclosure alone never changes context", () => {
  const index = indexMapExplorerView(view);
  const opened = revealMapExplorerContext(new Set(), index, "finality-in-consensus", true);
  assert.deepEqual([...opened].sort(), ["consensus-ordering", "finality-in-consensus"]);
  // Collapsing is a disclosure change: the URL-owned context is untouched.
  const finality = getVisibleMapExplorerRows(view, opened).find((row) => row.placementId === "finality-in-consensus")!;
  const collapsed = activateMapExplorerRow(finality, "finality-in-consensus", opened);
  assert.equal(getMapContextHref(collapsed.contextPlacementId), "/map?context=finality-in-consensus");
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

  assert.deepEqual(inConsensus.map((step) => step.label), ["Consensus & Ordering", "Finality"]);
  assert.deepEqual(inRollups.map((step) => step.label), ["Scaling & Modular Systems", "Rollups", "Finality"]);
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
  // Consensus is open: its own layer follows it, then the rest of the domain's L1 topics.
  const consensusRows = regions[3].rows.map((row) => [row.placementId, row.parentLabel]);
  assert.deepEqual(consensusRows.slice(0, 2), [
    ["consensus", "Consensus & Ordering"],
    ["consensus-models", "Consensus"],
  ]);
  assert.deepEqual(consensusRows.find(([id]) => id === "finality-in-consensus"), ["finality-in-consensus", "Consensus & Ordering"]);
  assert.equal(consensusRows.length, 10 + 6);
  // A collapsed region keeps its identity but exposes no rows; an empty one has none.
  assert.deepEqual(regions[14].rows, []);
  assert.equal(regions[14].header.hasChildren, true);
  assert.deepEqual(regions[23].rows, []);
  assert.equal(regions[23].header.hasChildren, false);
});

test("no entry context yields exactly the default initial state", () => {
  const state = getInitialMapExplorerState(view);
  assert.deepEqual([...state.expandedPlacementIds], getInitialExpandedPlacementIds());
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
  // Independent branches keep their default (collapsed) disclosure.
  assert.ok(!visible.includes("finality-in-rollups"));
  assert.ok(visible.includes("scaling-modular-systems"));
  assert.ok(!visible.includes("scaling"));
});

test("an entry context reveals its ancestry at arbitrary depth without opening its subtree", () => {
  const deepResolver = createMapResolver(chainModel(12));
  const deepView = buildMapExplorerView(deepResolver, rootPlacementIds(deepResolver));
  const state = getInitialMapExplorerState(deepView, "level-6");
  const visible = getVisibleMapExplorerRows(deepView, state.expandedPlacementIds).map((row) => row.placementId);

  assert.equal(state.focusedPlacementId, "level-6");
  assert.deepEqual(visible, Array.from({ length: 8 }, (_, i) => `level-${i}`));
});

test("an entry context reveals that placement and opens its exposition, not its sibling contexts", () => {
  const state = getInitialMapExplorerState(view, "finality-in-rollups");
  const rows = getVisibleMapExplorerRows(view, state.expandedPlacementIds);
  assert.deepEqual(rows.filter((row) => row.conceptId === "finality").map((row) => row.placementId), [
    "finality-in-rollups",
  ]);
  // Finality has canonical content, so entering at it opens its explanation.
  const finality = rows.find((row) => row.placementId === "finality-in-rollups");
  assert.ok(finality?.isExpanded && finality.hasContent && !finality.hasChildren);
});

test("an unknown entry context is ignored rather than breaking the explorer", () => {
  for (const context of ["unknown-placement", "", "finality"]) {
    assert.deepEqual(getInitialMapExplorerState(view, context), getInitialMapExplorerState(view));
  }
});

test("an L0 entry context focuses the domain; an empty domain adds no disclosure state", () => {
  const populated = getInitialMapExplorerState(view, "scaling-modular-systems");
  assert.equal(populated.focusedPlacementId, "scaling-modular-systems");
  assert.deepEqual([...populated.expandedPlacementIds], ["scaling-modular-systems"]);

  const empty = getInitialMapExplorerState(view, "autonomous-organizations");
  assert.equal(empty.focusedPlacementId, "autonomous-organizations");
  assert.deepEqual([...empty.expandedPlacementIds], getInitialExpandedPlacementIds());
});

test("a deep entry context reveals its full ancestor chain from the L0 domain", () => {
  const state = getInitialMapExplorerState(view, "finality-in-rollups");
  for (const id of ["scaling-modular-systems", "rollups"]) assert.ok(state.expandedPlacementIds.has(id), id);
  assert.deepEqual(
    getMapExplorerContext(indexMapExplorerView(view), state.focusedPlacementId).map((step) => step.placementId),
    ["scaling-modular-systems", "rollups", "finality-in-rollups"],
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

test("collapsed Foundations is identity only; opening it reveals its exposition and then its seven concepts", () => {
  const collapsed = getVisibleMapExplorerRows(view, new Set());
  const foundations = collapsed.find((row) => row.placementId === "foundations");
  assert.ok(foundations?.hasContent && foundations.isExpandable && !foundations.isExpanded);
  assert.ok(!collapsed.some((row) => row.depth > 0));

  const [region] = getVisibleMapExplorerRegions(view, new Set(["foundations"]));
  assert.ok(region.header.isExpanded && region.header.hasContent);
  assert.deepEqual(region.rows.map((row) => row.label), [
    "Protocols",
    "Distributed Systems",
    "State Machines",
    "Trust Models",
    "Coordination",
    "Adversarial Environments",
    "Protocol Properties",
  ]);
  // The seven are the next layer: closed, without exposition, each opening onto its own topics.
  assert.ok(region.rows.every((row) => row.depth === 1 && !row.hasContent && row.hasChildren && row.isExpandable && !row.isExpanded));
});

test("a concept is expandable when it has exposition or a next layer, never when empty", () => {
  const rows = getVisibleMapExplorerRows(view, new Set(mapKnowledge.placements.map((placement) => placement.id)));
  const byId = new Map(rows.map((row) => [row.placementId, row]));
  assert.ok(byId.get("finality-in-consensus")?.isExpandable); // content, no children
  assert.ok(byId.get("consensus")?.isExpandable); // children, no content
  assert.ok(!byId.get("autonomous-organizations")?.isExpandable); // neither
  assert.ok(byId.get("protocols")?.isExpandable); // children (L2), no content
  assert.ok(!byId.get("rules")?.isExpandable); // an L2 leaf
  assert.ok(!byId.get("protocol-properties-in-protocols")?.isExpandable); // its concept's properties sit under the L1 placement
  assert.ok(byId.get("finality-in-protocol-properties")?.isExpandable); // the canonical Finality exposition
});

test("Scaling & Modular Systems L2 topics are ordinary placements: context, ancestry, containing L0", () => {
  const index = indexMapExplorerView(view);
  const labels = (id: string) => getMapExplorerContext(index, id).map((step) => step.label);
  assert.deepEqual(labels("finality-in-rollups"), ["Scaling & Modular Systems", "Rollups", "Finality"]);
  assert.deepEqual(labels("interactive-fraud-proofs"), ["Scaling & Modular Systems", "Optimistic Rollups", "Interactive Fraud Proofs"]);
  assert.deepEqual(labels("data-availability-sampling-in-data-availability-layers"), ["Scaling & Modular Systems", "Data Availability Layers", "Data Availability Sampling"]);
  assert.deepEqual(labels("data-availability-sampling"), ["Storage & Availability", "Data Availability Sampling"]);
  assert.deepEqual(labels("shared-sequencing-in-rollup-sequencing"), ["Scaling & Modular Systems", "Rollup Sequencing", "Shared Sequencing"]);
  for (const id of ["rollups", "finality-in-rollups", "blobs-in-data-availability-layers", "security-inheritance"]) {
    assert.equal(resolveMapContextParam(index, [id]), id);
    assert.equal(getMapContextHref(id), `/map?context=${id}`);
  }
  assert.deepEqual([...getInitialMapExplorerState(view, "fraud-proofs").expandedPlacementIds].sort(), ["optimistic-rollups", "scaling-modular-systems"]);
  const rows = getVisibleMapExplorerRows(view, new Set(mapKnowledge.placements.map((placement) => placement.id)));
  const subtreeRows = rows.filter((row) => getContainingMapL0(index, row.placementId) === "scaling-modular-systems" && row.depth > 0);
  assert.equal(subtreeRows.length, 14 + 80);
  assert.ok(subtreeRows.filter((row) => row.depth === 1).every((row) => row.isExpandable && row.hasChildren && !row.hasContent));
  // L2 topics are leaves; the fixture's Finality keeps its canonical exposition, so it opens.
  assert.ok(subtreeRows.filter((row) => row.depth === 2).every((row) => !row.hasChildren && row.hasContent === (row.conceptId === "finality") && row.isExpandable === row.hasContent));
  for (const row of subtreeRows) {
    assert.equal(getContainingMapL0Ordinal(index, row.placementId), "15");
    assert.ok(row.depth <= 2, `${row.placementId} is at most L2`);
  }
});

test("Protocol Design & Lifecycle L2 topics are ordinary placements: context, ancestry, containing L0", () => {
  const index = indexMapExplorerView(view);
  const labels = (id: string) => getMapExplorerContext(index, id).map((step) => step.label);
  assert.deepEqual(labels("shadow-forks"), ["Protocol Design & Lifecycle", "Prototyping & Simulation", "Shadow Forks"]);
  assert.deepEqual(labels("rules-in-protocol-specification"), ["Protocol Design & Lifecycle", "Protocol Specification", "Rules"]);
  assert.deepEqual(labels("rules"), ["Foundations", "Protocols", "Rules"]);
  assert.deepEqual(labels("protocol-upgrades-in-change-management"), ["Protocol Design & Lifecycle", "Change Management", "Protocol Upgrades"]);
  for (const id of ["genesis", "testing-in-pre-launch-validation", "technical-debt-in-protocol-evolution", "protocol-sunsetting"]) {
    assert.equal(resolveMapContextParam(index, [id]), id);
    assert.equal(getMapContextHref(id), `/map?context=${id}`);
  }
  assert.deepEqual([...getInitialMapExplorerState(view, "hard-forks").expandedPlacementIds].sort(), ["change-management", "protocol-design-lifecycle"]);
  const rows = getVisibleMapExplorerRows(view, new Set(mapKnowledge.placements.map((placement) => placement.id)));
  const subtreeRows = rows.filter((row) => getContainingMapL0(index, row.placementId) === "protocol-design-lifecycle" && row.depth > 0);
  assert.equal(subtreeRows.length, 14 + 81);
  assert.ok(subtreeRows.filter((row) => row.depth === 1).every((row) => row.isExpandable && row.hasChildren && !row.hasContent));
  assert.ok(subtreeRows.filter((row) => row.depth === 2).every((row) => !row.isExpandable && !row.hasChildren && !row.hasContent));
  for (const row of subtreeRows) {
    assert.equal(getContainingMapL0Ordinal(index, row.placementId), "19");
    assert.ok(row.depth <= 2, `${row.placementId} is at most L2`);
  }
});

test("Protocol Architecture L2 topics are ordinary placements: context, ancestry, containing L0", () => {
  const index = indexMapExplorerView(view);
  const labels = (id: string) => getMapExplorerContext(index, id).map((step) => step.label);
  assert.deepEqual(labels("trusted-computing-base"), ["Protocol Architecture", "Trust Architecture", "Trusted Computing Base"]);
  assert.deepEqual(labels("modularity-in-protocol-layers"), ["Protocol Architecture", "Protocol Layers", "Modularity"]);
  assert.deepEqual(labels("modularity"), ["Scaling & Modular Systems", "Modularity"]);
  assert.deepEqual(labels("execution-models-in-execution-architecture"), ["Protocol Architecture", "Execution Architecture", "Execution Models"]);
  for (const id of ["proxy-patterns", "modularity-in-protocol-layers", "cross-chain-composability-in-composability", "composability"]) {
    assert.equal(resolveMapContextParam(index, [id]), id);
    assert.equal(getMapContextHref(id), `/map?context=${id}`);
  }
  assert.deepEqual([...getInitialMapExplorerState(view, "coupling").expandedPlacementIds].sort(), ["architectural-tradeoffs", "protocol-architecture"]);
  const rows = getVisibleMapExplorerRows(view, new Set(mapKnowledge.placements.map((placement) => placement.id)));
  const subtreeRows = rows.filter((row) => getContainingMapL0(index, row.placementId) === "protocol-architecture" && row.depth > 0);
  assert.equal(subtreeRows.length, 12 + 68);
  assert.ok(subtreeRows.filter((row) => row.depth === 1).every((row) => row.isExpandable && row.hasChildren && !row.hasContent));
  assert.ok(subtreeRows.filter((row) => row.depth === 2).every((row) => !row.isExpandable && !row.hasChildren && !row.hasContent));
  for (const row of subtreeRows) {
    assert.equal(getContainingMapL0Ordinal(index, row.placementId), "18");
    assert.ok(row.depth <= 2, `${row.placementId} is at most L2`);
  }
});

test("Security, Correctness & Resilience L2 topics are ordinary placements: context, ancestry, containing L0", () => {
  const index = indexMapExplorerView(view);
  const labels = (id: string) => getMapExplorerContext(index, id).map((step) => step.label);
  assert.deepEqual(labels("property-based-testing"), ["Security, Correctness & Resilience", "Testing", "Property-Based Testing"]);
  assert.deepEqual(labels("incident-response-in-security-correctness-resilience"), ["Security, Correctness & Resilience", "Incident Response"]);
  assert.deepEqual(labels("incident-response"), ["Governance & Institutions", "Emergency Governance", "Incident Response"]);
  assert.deepEqual(labels("bridge-security-in-domain-specific-security"), ["Security, Correctness & Resilience", "Domain-Specific Security", "Bridge Security"]);
  assert.deepEqual(labels("safety-in-security-properties"), ["Security, Correctness & Resilience", "Security Properties", "Safety"]);
  for (const id of ["reentrancy", "incident-response-in-security-correctness-resilience", "verification-in-correctness", "circuit-breakers-in-incident-response"]) {
    assert.equal(resolveMapContextParam(index, [id]), id);
    assert.equal(getMapContextHref(id), `/map?context=${id}`);
  }
  assert.deepEqual([...getInitialMapExplorerState(view, "fuzzing").expandedPlacementIds].sort(), ["security-correctness-resilience", "testing"]);
  const rows = getVisibleMapExplorerRows(view, new Set(mapKnowledge.placements.map((placement) => placement.id)));
  const subtreeRows = rows.filter((row) => getContainingMapL0(index, row.placementId) === "security-correctness-resilience" && row.depth > 0);
  assert.equal(subtreeRows.length, 20 + 119);
  assert.ok(subtreeRows.filter((row) => row.depth === 1).every((row) => row.isExpandable && row.hasChildren && !row.hasContent));
  assert.ok(subtreeRows.filter((row) => row.depth === 2).every((row) => !row.isExpandable && !row.hasChildren && !row.hasContent));
  for (const row of subtreeRows) {
    assert.equal(getContainingMapL0Ordinal(index, row.placementId), "17");
    assert.ok(row.depth <= 2, `${row.placementId} is at most L2`);
  }
});

test("Interoperability & Abstraction L2 topics are ordinary placements: context, ancestry, containing L0", () => {
  const index = indexMapExplorerView(view);
  const labels = (id: string) => getMapExplorerContext(index, id).map((step) => step.label);
  assert.deepEqual(labels("hashed-timelock-contracts"), ["Interoperability & Abstraction", "Cross-Chain Atomicity", "Hashed Timelock Contracts"]);
  assert.deepEqual(labels("finality-in-cross-chain-verification"), ["Interoperability & Abstraction", "Cross-Chain Verification", "Finality"]);
  assert.deepEqual(labels("cross-domain-execution-in-interoperability-abstraction"), ["Interoperability & Abstraction", "Cross-Chain Execution"]);
  assert.deepEqual(labels("cross-domain-execution"), ["Intents & Coordination", "Cross-Domain Coordination", "Cross-Domain Execution"]);
  assert.deepEqual(labels("account-abstraction-in-chain-abstraction"), ["Interoperability & Abstraction", "Chain Abstraction", "Account Abstraction"]);
  for (const id of ["bridges", "cross-domain-settlement-in-interoperability-abstraction", "state-proofs-in-cross-chain-state", "zk-verification"]) {
    assert.equal(resolveMapContextParam(index, [id]), id);
    assert.equal(getMapContextHref(id), `/map?context=${id}`);
  }
  assert.deepEqual([...getInitialMapExplorerState(view, "lock-and-mint").expandedPlacementIds].sort(), ["asset-bridging", "interoperability-abstraction"]);
  const rows = getVisibleMapExplorerRows(view, new Set(mapKnowledge.placements.map((placement) => placement.id)));
  const subtreeRows = rows.filter((row) => getContainingMapL0(index, row.placementId) === "interoperability-abstraction" && row.depth > 0);
  assert.equal(subtreeRows.length, 14 + 82);
  assert.ok(subtreeRows.filter((row) => row.depth === 1).every((row) => row.isExpandable && row.hasChildren && !row.hasContent));
  // L2 topics are leaves; the reused Finality keeps its canonical exposition, so it opens.
  assert.ok(subtreeRows.filter((row) => row.depth === 2).every((row) => !row.hasChildren && row.hasContent === (row.conceptId === "finality") && row.isExpandable === row.hasContent));
  for (const row of subtreeRows) {
    assert.equal(getContainingMapL0Ordinal(index, row.placementId), "16");
    assert.ok(row.depth <= 2, `${row.placementId} is at most L2`);
  }
});

test("Governance & Institutions L2 topics are ordinary placements: context, ancestry, containing L0", () => {
  const index = indexMapExplorerView(view);
  const labels = (id: string) => getMapExplorerContext(index, id).map((step) => step.label);
  assert.deepEqual(labels("quorum-requirements"), ["Governance & Institutions", "Decision Rules", "Quorum Requirements"]);
  assert.deepEqual(labels("borrowed-voting-power"), ["Governance & Institutions", "Governance Attacks", "Borrowed Voting Power"]);
  assert.deepEqual(labels("delegation-in-representation"), ["Governance & Institutions", "Representation", "Delegation"]);
  assert.deepEqual(labels("evidence-in-dispute-resolution"), ["Governance & Institutions", "Dispute Resolution", "Evidence"]);
  assert.deepEqual(labels("delegation"), ["Identity, Accounts & Authority", "Authority", "Delegation"]);
  for (const id of ["timelocks", "delegation-in-representation", "incentive-alignment-in-institutional-design", "checks-balances"]) {
    assert.equal(resolveMapContextParam(index, [id]), id);
    assert.equal(getMapContextHref(id), `/map?context=${id}`);
  }
  assert.deepEqual([...getInitialMapExplorerState(view, "guardians").expandedPlacementIds].sort(), ["emergency-governance", "governance-institutions"]);
  const rows = getVisibleMapExplorerRows(view, new Set(mapKnowledge.placements.map((placement) => placement.id)));
  const subtreeRows = rows.filter((row) => getContainingMapL0(index, row.placementId) === "governance-institutions" && row.depth > 0);
  assert.equal(subtreeRows.length, 15 + 89);
  assert.ok(subtreeRows.filter((row) => row.depth === 1).every((row) => row.isExpandable && row.hasChildren && !row.hasContent));
  assert.ok(subtreeRows.filter((row) => row.depth === 2).every((row) => !row.isExpandable && !row.hasChildren && !row.hasContent));
  for (const row of subtreeRows) {
    assert.equal(getContainingMapL0Ordinal(index, row.placementId), "14");
    assert.ok(row.depth <= 2, `${row.placementId} is at most L2`);
  }
});

test("Intents & Coordination L2 topics are ordinary placements: context, ancestry, containing L0", () => {
  const index = indexMapExplorerView(view);
  const labels = (id: string) => getMapExplorerContext(index, id).map((step) => step.label);
  assert.deepEqual(labels("coincidence-of-wants"), ["Intents & Coordination", "Matching", "Coincidence of Wants"]);
  assert.deepEqual(labels("cross-venue-routing"), ["Intents & Coordination", "Routing", "Cross-Venue Routing"]);
  assert.deepEqual(labels("preconfirmations-in-intent-commitments"), ["Intents & Coordination", "Commitments", "Preconfirmations"]);
  assert.deepEqual(labels("settlement-in-intent-settlement"), ["Intents & Coordination", "Intent Settlement", "Settlement"]);
  assert.deepEqual(labels("settlement"), ["Markets & Financial Protocols", "Derivatives", "Settlement"]);
  assert.deepEqual(labels("delegation-in-intents"), ["Intents & Coordination", "Intents", "Delegation"]);
  for (const id of ["intent-matching", "settlement-in-intent-settlement", "shared-sequencing-in-cross-domain-coordination", "fulfillment"]) {
    assert.equal(resolveMapContextParam(index, [id]), id);
    assert.equal(getMapContextHref(id), `/map?context=${id}`);
  }
  assert.deepEqual([...getInitialMapExplorerState(view, "ring-trades").expandedPlacementIds].sort(), ["intent-matching", "intents-coordination"]);
  const rows = getVisibleMapExplorerRows(view, new Set(mapKnowledge.placements.map((placement) => placement.id)));
  const subtreeRows = rows.filter((row) => getContainingMapL0(index, row.placementId) === "intents-coordination" && row.depth > 0);
  assert.equal(subtreeRows.length, 12 + 71);
  assert.ok(subtreeRows.filter((row) => row.depth === 1).every((row) => row.isExpandable && row.hasChildren && !row.hasContent));
  assert.ok(subtreeRows.filter((row) => row.depth === 2).every((row) => !row.isExpandable && !row.hasChildren && !row.hasContent));
  for (const row of subtreeRows) {
    assert.equal(getContainingMapL0Ordinal(index, row.placementId), "13");
    assert.ok(row.depth <= 2, `${row.placementId} is at most L2`);
  }
});

test("MEV & Execution Markets L2 topics are ordinary placements: context, ancestry, containing L0", () => {
  const index = indexMapExplorerView(view);
  const labels = (id: string) => getMapExplorerContext(index, id).map((step) => step.label);
  assert.deepEqual(labels("slippage-exploitation"), ["MEV & Execution Markets", "Sandwiching", "Slippage Exploitation"]);
  assert.deepEqual(labels("order-flow-competition"), ["MEV & Execution Markets", "Order Flow", "Order Flow Competition"]);
  // Shared concepts, each in its own context.
  assert.deepEqual(labels("transaction-ordering-in-mev-execution-markets"), ["MEV & Execution Markets", "Transaction Ordering"]);
  assert.deepEqual(labels("transaction-ordering-in-block-building"), ["Consensus & Ordering", "Block Building", "Transaction Ordering"]);
  assert.deepEqual(labels("builders-in-mev-execution-markets"), ["MEV & Execution Markets", "Builders"]);
  assert.deepEqual(labels("builders"), ["Consensus & Ordering", "Proposer-Builder Separation", "Builders"]);
  assert.deepEqual(labels("block-construction-in-builders"), ["MEV & Execution Markets", "Builders", "Block Construction"]);
  assert.deepEqual(labels("auction-clearing-in-mev-auctions"), ["MEV & Execution Markets", "MEV Auctions", "Auction Clearing"]);
  assert.deepEqual(labels("inclusion-guarantees-in-mev-mitigation"), ["MEV & Execution Markets", "MEV Mitigation", "Inclusion Guarantees"]);
  for (const id of ["transaction-ordering-in-mev-execution-markets", "builders-in-mev-execution-markets", "private-mempools-in-private-execution", "commit-reveal"]) {
    assert.equal(resolveMapContextParam(index, [id]), id);
    assert.equal(getMapContextHref(id), `/map?context=${id}`);
  }
  assert.equal(resolveMapContextParam(index, ["builders-in-mev"]), null);
  assert.deepEqual([...getInitialMapExplorerState(view, "fair-ordering").expandedPlacementIds].sort(), ["mev-execution-markets", "transaction-ordering-in-mev-execution-markets"]);
  const rows = getVisibleMapExplorerRows(view, new Set(mapKnowledge.placements.map((placement) => placement.id)));
  const subtreeRows = rows.filter((row) => getContainingMapL0(index, row.placementId) === "mev-execution-markets" && row.depth > 0);
  assert.equal(subtreeRows.length, 13 + 79);
  assert.ok(subtreeRows.filter((row) => row.depth === 1).every((row) => row.isExpandable && row.hasChildren && !row.hasContent));
  assert.ok(subtreeRows.filter((row) => row.depth === 2).every((row) => !row.isExpandable && !row.hasChildren && !row.hasContent));
  for (const row of subtreeRows) {
    assert.equal(getContainingMapL0Ordinal(index, row.placementId), "12");
    assert.ok(row.depth <= 2, `${row.placementId} is at most L2`);
  }
});

test("Markets & Financial Protocols L2 topics are ordinary placements: context, ancestry, containing L0", () => {
  const index = indexMapExplorerView(view);
  const labels = (id: string) => getMapExplorerContext(index, id).map((step) => step.label);
  assert.deepEqual(labels("crypto-backed-stablecoins"), ["Markets & Financial Protocols", "Stablecoins", "Crypto-Backed Stablecoins"]);
  assert.deepEqual(labels("undercollateralization"), ["Markets & Financial Protocols", "Collateral", "Undercollateralization"]);
  assert.deepEqual(labels("settlement"), ["Markets & Financial Protocols", "Derivatives", "Settlement"]);
  // Shared concepts, each in its own context.
  assert.deepEqual(labels("liquidity-risk-in-liquidity"), ["Markets & Financial Protocols", "Liquidity", "Liquidity Risk"]);
  assert.deepEqual(labels("liquidity-risk-in-risk"), ["Markets & Financial Protocols", "Risk", "Liquidity Risk"]);
  assert.deepEqual(labels("bids-in-order-books"), ["Markets & Financial Protocols", "Order Books", "Bids"]);
  assert.deepEqual(labels("bids"), ["Economics & Mechanism Design", "Auctions", "Bids"]);
  for (const id of ["settlement", "liquidity-risk-in-risk", "bids-in-order-books", "impermanent-loss"]) {
    assert.equal(resolveMapContextParam(index, [id]), id);
    assert.equal(getMapContextHref(id), `/map?context=${id}`);
  }
  assert.equal(resolveMapContextParam(index, ["liquidity-risk"]), null);
  assert.deepEqual([...getInitialMapExplorerState(view, "bad-debt").expandedPlacementIds].sort(), ["liquidations", "markets-financial-protocols"]);
  const rows = getVisibleMapExplorerRows(view, new Set(mapKnowledge.placements.map((placement) => placement.id)));
  const subtreeRows = rows.filter((row) => getContainingMapL0(index, row.placementId) === "markets-financial-protocols" && row.depth > 0);
  assert.equal(subtreeRows.length, 12 + 72);
  assert.ok(subtreeRows.filter((row) => row.depth === 1).every((row) => row.isExpandable && row.hasChildren && !row.hasContent));
  assert.ok(subtreeRows.filter((row) => row.depth === 2).every((row) => !row.isExpandable && !row.hasChildren && !row.hasContent));
  for (const row of subtreeRows) {
    assert.equal(getContainingMapL0Ordinal(index, row.placementId), "11");
    assert.ok(row.depth <= 2, `${row.placementId} is at most L2`);
  }
});

test("Autonomous Execution L2 topics are ordinary placements: context, ancestry, containing L0", () => {
  const index = indexMapExplorerView(view);
  const labels = (id: string) => getMapExplorerContext(index, id).map((step) => step.label);
  assert.deepEqual(labels("human-approval"), ["Autonomous Execution", "Execution Authorization", "Human Approval"]);
  assert.deepEqual(labels("transaction-simulation"), ["Autonomous Execution", "Simulation", "Transaction Simulation"]);
  // Reused concepts: each placement keeps its own context.
  assert.deepEqual(labels("plans-in-execution-planning"), ["Autonomous Execution", "Execution Planning", "Plans"]);
  assert.deepEqual(labels("plans"), ["AI & Intelligent Systems", "Goals & Planning", "Plans"]);
  assert.deepEqual(labels("settlement-in-verification-settlement"), ["Autonomous Execution", "Verification & Settlement", "Settlement"]);
  for (const id of ["simulation", "policy-constraints-in-execution-policies", "kill-switches"]) {
    assert.equal(resolveMapContextParam(index, [id]), id);
    assert.equal(getMapContextHref(id), `/map?context=${id}`);
  }
  assert.deepEqual([...getInitialMapExplorerState(view, "sandboxing").expandedPlacementIds].sort(), ["autonomous-execution", "execution-environments"]);
  const rows = getVisibleMapExplorerRows(view, new Set(mapKnowledge.placements.map((placement) => placement.id)));
  const subtreeRows = rows.filter((row) => getContainingMapL0(index, row.placementId) === "autonomous-execution" && row.depth > 0);
  assert.equal(subtreeRows.length, 11 + 66);
  assert.ok(subtreeRows.filter((row) => row.depth === 1).every((row) => row.isExpandable && row.hasChildren && !row.hasContent));
  assert.ok(subtreeRows.filter((row) => row.depth === 2).every((row) => !row.isExpandable && !row.hasChildren && !row.hasContent));
  for (const row of subtreeRows) {
    assert.equal(getContainingMapL0Ordinal(index, row.placementId), "23");
    assert.ok(row.depth <= 2, `${row.placementId} is at most L2`);
  }
});

test("Autonomous Coordination L2 topics are ordinary placements: context, ancestry, containing L0", () => {
  const index = indexMapExplorerView(view);
  const labels = (id: string) => getMapExplorerContext(index, id).map((step) => step.label);
  assert.deepEqual(labels("communication-semantics"), ["Autonomous Coordination", "Agent-to-Agent Communication", "Communication Semantics"]);
  assert.deepEqual(labels("collective-decision-making"), ["Autonomous Coordination", "Multi-Agent Coordination", "Collective Decision-Making"]);
  // Contextual wording.
  assert.deepEqual(labels("negotiated-agreement"), ["Autonomous Coordination", "Negotiation", "Agreement"]);
  assert.deepEqual(labels("competitive-selection"), ["Autonomous Coordination", "Competition", "Selection"]);
  assert.deepEqual(labels("agent-synchronization"), ["Autonomous Coordination", "Multi-Agent Coordination", "Synchronization"]);
  // Reused concepts: each placement keeps its own context.
  assert.deepEqual(labels("negotiation-in-autonomous-coordination"), ["Autonomous Coordination", "Negotiation"]);
  assert.deepEqual(labels("negotiation"), ["Machine Economy", "Machine Commerce", "Negotiation"]);
  assert.deepEqual(labels("delegation-in-autonomous-coordination"), ["Autonomous Coordination", "Delegation"]);
  assert.deepEqual(labels("delegation"), ["Identity, Accounts & Authority", "Authority", "Delegation"]);
  assert.deepEqual(labels("cooperation-in-autonomous-coordination"), ["Autonomous Coordination", "Cooperation"]);
  assert.deepEqual(labels("cooperation"), ["Foundations", "Coordination", "Cooperation"]);
  assert.deepEqual(labels("resource-allocation-in-autonomous-coordination"), ["Autonomous Coordination", "Resource Allocation"]);
  assert.deepEqual(labels("resource-allocation"), ["Economics & Mechanism Design", "Resource Allocation"]);
  assert.deepEqual(labels("service-discovery-in-agent-discovery"), ["Autonomous Coordination", "Agent Discovery", "Service Discovery"]);
  assert.deepEqual(labels("strategic-behavior-in-competition"), ["Autonomous Coordination", "Competition", "Strategic Behavior"]);
  assert.deepEqual(labels("revocation-in-delegation"), ["Autonomous Coordination", "Delegation", "Revocation"]);
  for (const id of ["negotiation-in-autonomous-coordination", "delegation-in-autonomous-coordination", "agent-synchronization", "revocation-in-delegation", "task-settlement"]) {
    assert.equal(resolveMapContextParam(index, [id]), id);
    assert.equal(getMapContextHref(id), `/map?context=${id}`);
  }
  assert.deepEqual([...getInitialMapExplorerState(view, "coalition-stability").expandedPlacementIds].sort(), ["autonomous-coordination", "coalition-formation"]);
  const rows = getVisibleMapExplorerRows(view, new Set(mapKnowledge.placements.map((placement) => placement.id)));
  const subtreeRows = rows.filter((row) => getContainingMapL0(index, row.placementId) === "autonomous-coordination" && row.depth > 0);
  assert.equal(subtreeRows.length, 10 + 60);
  assert.ok(subtreeRows.filter((row) => row.depth === 1).every((row) => row.isExpandable && row.hasChildren && !row.hasContent));
  assert.ok(subtreeRows.filter((row) => row.depth === 2).every((row) => !row.isExpandable && !row.hasChildren && !row.hasContent));
  for (const row of subtreeRows) {
    assert.equal(getContainingMapL0Ordinal(index, row.placementId), "22");
    assert.ok(row.depth <= 2, `${row.placementId} is at most L2`);
  }
});

test("Machine Economy L2 topics are ordinary placements: context, ancestry, containing L0", () => {
  const index = indexMapExplorerView(view);
  const labels = (id: string) => getMapExplorerContext(index, id).map((step) => step.label);
  assert.deepEqual(labels("machine-to-machine-payments"), ["Machine Economy", "Machine Payments", "Machine-to-Machine Payments"]);
  assert.deepEqual(labels("principal-agent-problems"), ["Machine Economy", "Agent Incentives", "Principal-Agent Problems"]);
  // Contextual wording.
  assert.deepEqual(labels("ai-agent-in-economic-agents"), ["Machine Economy", "Economic Agents", "AI Agents"]);
  assert.deepEqual(labels("agent-credentials-in-agent-identity"), ["Machine Economy", "Agent Identity", "Credentials"]);
  assert.deepEqual(labels("machine-authentication-in-agent-identity"), ["Machine Economy", "Agent Identity", "Authentication"]);
  assert.deepEqual(labels("agent-reputation-in-agent-identity"), ["Machine Economy", "Agent Identity", "Reputation"]);
  assert.deepEqual(labels("authority-escalation"), ["Machine Economy", "Agent Permissions", "Escalation"]);
  assert.deepEqual(labels("credit-default"), ["Machine Economy", "Agent Credit", "Default"]);
  assert.deepEqual(labels("agent-objectives"), ["Machine Economy", "Agent Incentives", "Objectives"]);
  // Reused concepts: each placement keeps its own context.
  assert.deepEqual(labels("agent-identity-in-machine-economy"), ["Machine Economy", "Agent Identity"]);
  assert.deepEqual(labels("agent-identity"), ["Identity, Accounts & Authority", "Machine Identity", "Agent Identity"]);
  assert.deepEqual(labels("agent-reputation-in-machine-economy"), ["Machine Economy", "Agent Reputation"]);
  assert.deepEqual(labels("agent-reputation"), ["Identity, Accounts & Authority", "Machine Identity", "Agent Reputation"]);
  assert.deepEqual(labels("ai-agent"), ["AI & Intelligent Systems", "AI Agents"]);
  assert.deepEqual(labels("assets-in-agent-capital"), ["Machine Economy", "Agent Capital", "Assets"]);
  assert.deepEqual(labels("assets"), ["Markets & Financial Protocols", "Assets"]);
  assert.deepEqual(labels("settlement-in-machine-commerce"), ["Machine Economy", "Machine Commerce", "Settlement"]);
  assert.deepEqual(labels("settlement"), ["Markets & Financial Protocols", "Derivatives", "Settlement"]);
  assert.deepEqual(labels("delegation-in-agent-permissions"), ["Machine Economy", "Agent Permissions", "Delegation"]);
  assert.deepEqual(labels("protocols-in-economic-agents"), ["Machine Economy", "Economic Agents", "Protocols"]);
  assert.deepEqual(labels("protocols"), ["Foundations", "Protocols"]);
  for (const id of ["agent-identity-in-machine-economy", "agent-reputation-in-machine-economy", "ai-agent-in-economic-agents", "credit-default", "settlement-in-machine-commerce"]) {
    assert.equal(resolveMapContextParam(index, [id]), id);
    assert.equal(getMapContextHref(id), `/map?context=${id}`);
  }
  assert.deepEqual([...getInitialMapExplorerState(view, "micropayments").expandedPlacementIds].sort(), ["machine-economy", "machine-payments"]);
  const rows = getVisibleMapExplorerRows(view, new Set(mapKnowledge.placements.map((placement) => placement.id)));
  const subtreeRows = rows.filter((row) => getContainingMapL0(index, row.placementId) === "machine-economy" && row.depth > 0);
  assert.equal(subtreeRows.length, 14 + 84);
  // Agent Identity's L1 placement carries its canonical exposition as well as its layer.
  assert.ok(subtreeRows.filter((row) => row.depth === 1).every((row) => row.isExpandable && row.hasChildren && row.hasContent === (row.conceptId === "agent-identity")));
  assert.ok(subtreeRows.filter((row) => row.depth === 2).every((row) => !row.isExpandable && !row.hasChildren && !row.hasContent));
  for (const row of subtreeRows) {
    assert.equal(getContainingMapL0Ordinal(index, row.placementId), "21");
    assert.ok(row.depth <= 2, `${row.placementId} is at most L2`);
  }
});

test("AI & Intelligent Systems L2 topics are ordinary placements: context, ancestry, containing L0", () => {
  const index = indexMapExplorerView(view);
  const labels = (id: string) => getMapExplorerContext(index, id).map((step) => step.label);
  assert.deepEqual(labels("zkml"), ["AI & Intelligent Systems", "Verifiable AI", "zkML"]);
  assert.deepEqual(labels("retrieval-augmented-generation"), ["AI & Intelligent Systems", "Memory & Context", "Retrieval-Augmented Generation"]);
  // The fixture's AI Agent placement shows as "AI Agents".
  assert.deepEqual(labels("ai-agent"), ["AI & Intelligent Systems", "AI Agents"]);
  assert.deepEqual(labels("principals"), ["AI & Intelligent Systems", "AI Agents", "Principals"]);
  // Reused concepts: each placement keeps its own context.
  assert.deepEqual(labels("ai-inference-in-ai-intelligent-systems"), ["AI & Intelligent Systems", "AI Inference"]);
  assert.deepEqual(labels("ai-inference"), ["Oracles & External Reality", "AI-Interpreted Data", "AI Inference"]);
  assert.deepEqual(labels("inference-confidence-in-uncertainty-reliability"), ["AI & Intelligent Systems", "Uncertainty & Reliability", "Inference Confidence"]);
  assert.deepEqual(labels("inference-confidence"), ["Oracles & External Reality", "AI-Interpreted Data", "Confidence"]);
  assert.deepEqual(labels("delegation-in-ai-agents"), ["AI & Intelligent Systems", "AI Agents", "Delegation"]);
  assert.deepEqual(labels("delegation"), ["Identity, Accounts & Authority", "Authority", "Delegation"]);
  assert.deepEqual(labels("agent-identity-in-ai-agents"), ["AI & Intelligent Systems", "AI Agents", "Agent Identity"]);
  assert.deepEqual(labels("trusted-execution-in-verifiable-ai"), ["AI & Intelligent Systems", "Verifiable AI", "Trusted Execution"]);
  assert.deepEqual(labels("trusted-execution"), ["Computation & Execution", "Off-Chain Computation", "Trusted Execution"]);
  for (const id of ["ai-agent", "zkml", "delegation-in-ai-agents", "inference-confidence-in-uncertainty-reliability", "ai-inference-in-ai-intelligent-systems"]) {
    assert.equal(resolveMapContextParam(index, [id]), id);
    assert.equal(getMapContextHref(id), `/map?context=${id}`);
  }
  assert.deepEqual([...getInitialMapExplorerState(view, "prompt-injection").expandedPlacementIds].sort(), ["ai-intelligent-systems", "ai-security"]);
  // A context with exposition also opens itself to reveal it.
  assert.deepEqual([...getInitialMapExplorerState(view, "agent-identity-in-ai-agents").expandedPlacementIds].sort(), ["agent-identity-in-ai-agents", "ai-agent", "ai-intelligent-systems"]);
  const rows = getVisibleMapExplorerRows(view, new Set(mapKnowledge.placements.map((placement) => placement.id)));
  const subtreeRows = rows.filter((row) => getContainingMapL0(index, row.placementId) === "ai-intelligent-systems" && row.depth > 0);
  assert.equal(subtreeRows.length, 12 + 69);
  assert.ok(subtreeRows.filter((row) => row.depth === 1).every((row) => row.isExpandable && row.hasChildren && !row.hasContent));
  // Only the reused Agent Identity brings its canonical exposition.
  assert.ok(subtreeRows.filter((row) => row.depth === 2).every((row) => !row.hasChildren && row.hasContent === (row.conceptId === "agent-identity") && row.isExpandable === row.hasContent));
  for (const row of subtreeRows) {
    assert.equal(getContainingMapL0Ordinal(index, row.placementId), "20");
    assert.ok(row.depth <= 2, `${row.placementId} is at most L2`);
  }
});

test("Economics & Mechanism Design L2 topics are ordinary placements: context, ancestry, containing L0", () => {
  const index = indexMapExplorerView(view);
  const labels = (id: string) => getMapExplorerContext(index, id).map((step) => step.label);
  assert.deepEqual(labels("cryptoeconomic-assumptions"), ["Economics & Mechanism Design", "Cryptoeconomic Security", "Cryptoeconomic Assumptions"]);
  assert.deepEqual(labels("nash-equilibrium"), ["Economics & Mechanism Design", "Game Theory", "Nash Equilibrium"]);
  assert.deepEqual(labels("mechanism-objectives"), ["Economics & Mechanism Design", "Mechanism Design", "Objectives"]);
  assert.deepEqual(labels("penalties-in-cryptoeconomic-security"), ["Economics & Mechanism Design", "Cryptoeconomic Security", "Economic Penalties"]);
  assert.deepEqual(labels("penalties"), ["Economics & Mechanism Design", "Incentives", "Penalties"]);
  assert.deepEqual(labels("strategic-behavior-in-economics-mechanism-design"), ["Economics & Mechanism Design", "Strategic Behavior"]);
  assert.deepEqual(labels("strategic-behavior"), ["Foundations", "Adversarial Environments", "Strategic Behavior"]);
  for (const id of ["griefing", "strategic-behavior-in-economics-mechanism-design", "penalties-in-cryptoeconomic-security", "cost-of-corruption"]) {
    assert.equal(resolveMapContextParam(index, [id]), id);
    assert.equal(getMapContextHref(id), `/map?context=${id}`);
  }
  assert.deepEqual([...getInitialMapExplorerState(view, "slashing").expandedPlacementIds].sort(), ["economics-mechanism-design", "staking-economics"]);
  const rows = getVisibleMapExplorerRows(view, new Set(mapKnowledge.placements.map((placement) => placement.id)));
  const subtreeRows = rows.filter((row) => getContainingMapL0(index, row.placementId) === "economics-mechanism-design" && row.depth > 0);
  assert.equal(subtreeRows.length, 11 + 66);
  assert.ok(subtreeRows.filter((row) => row.depth === 1).every((row) => row.isExpandable && row.hasChildren && !row.hasContent));
  assert.ok(subtreeRows.filter((row) => row.depth === 2).every((row) => !row.isExpandable && !row.hasChildren && !row.hasContent));
  for (const row of subtreeRows) {
    assert.equal(getContainingMapL0Ordinal(index, row.placementId), "10");
    assert.ok(row.depth <= 2, `${row.placementId} is at most L2`);
  }
});

test("Oracles & External Reality L2 topics are ordinary placements: context, ancestry, containing L0", () => {
  const index = indexMapExplorerView(view);
  const labels = (id: string) => getMapExplorerContext(index, id).map((step) => step.label);
  assert.deepEqual(labels("cyber-physical-interfaces"), ["Oracles & External Reality", "Sensors & External Systems", "Cyber-Physical Interfaces"]);
  assert.deepEqual(labels("interpretation-verification"), ["Oracles & External Reality", "AI-Interpreted Data", "Interpretation Verification"]);
  assert.deepEqual(labels("medianization"), ["Oracles & External Reality", "Aggregation", "Medianization"]);
  // Contextual wording over shared or distinct concepts.
  assert.deepEqual(labels("external-data-in-oracle-problem"), ["Oracles & External Reality", "Oracle Problem", "External Information"]);
  assert.deepEqual(labels("external-data-availability"), ["Oracles & External Reality", "Oracle Problem", "Data Availability"]);
  assert.deepEqual(labels("information-extraction"), ["Oracles & External Reality", "AI-Interpreted Data", "Data Extraction"]);
  assert.deepEqual(labels("lineage-in-oracles-external-reality"), ["Oracles & External Reality", "Provenance", "Data Lineage"]);
  assert.deepEqual(labels("external-apis-in-data-sources"), ["Oracles & External Reality", "Data Sources", "APIs"]);
  assert.deepEqual(labels("real-world-attesters"), ["Oracles & External Reality", "Real-World Attestations", "Attesters"]);
  // The same concepts elsewhere keep their own contexts.
  assert.deepEqual(labels("provenance"), ["State & Data", "Provenance"]);
  assert.deepEqual(labels("consensus-in-oracle-networks"), ["Oracles & External Reality", "Oracle Networks", "Consensus"]);
  for (const id of ["provenance-in-oracles-external-reality", "oracle-aggregation", "consensus-in-oracle-networks", "inference-confidence"]) {
    assert.equal(resolveMapContextParam(index, [id]), id);
    assert.equal(getMapContextHref(id), `/map?context=${id}`);
  }
  assert.deepEqual([...getInitialMapExplorerState(view, "staleness").expandedPlacementIds].sort(), ["freshness", "oracles-external-reality"]);
  const rows = getVisibleMapExplorerRows(view, new Set(mapKnowledge.placements.map((placement) => placement.id)));
  const subtreeRows = rows.filter((row) => getContainingMapL0(index, row.placementId) === "oracles-external-reality" && row.depth > 0);
  assert.equal(subtreeRows.length, 12 + 70);
  assert.ok(subtreeRows.filter((row) => row.depth === 1).every((row) => row.isExpandable && row.hasChildren && !row.hasContent));
  assert.ok(subtreeRows.filter((row) => row.depth === 2).every((row) => !row.isExpandable && !row.hasChildren && !row.hasContent));
  for (const row of subtreeRows) {
    assert.equal(getContainingMapL0Ordinal(index, row.placementId), "09");
    assert.ok(row.depth <= 2, `${row.placementId} is at most L2`);
  }
});

test("Identity, Accounts & Authority L2 topics are ordinary placements: context, ancestry, containing L0", () => {
  const index = indexMapExplorerView(view);
  const labels = (id: string) => getMapExplorerContext(index, id).map((step) => step.label);
  assert.deepEqual(labels("agent-identity"), ["Identity, Accounts & Authority", "Machine Identity", "Agent Identity"]);
  assert.deepEqual(labels("externally-owned-accounts"), ["Identity, Accounts & Authority", "Accounts", "Externally Owned Accounts"]);
  assert.deepEqual(labels("credential-authentication"), ["Identity, Accounts & Authority", "Authentication", "Credential Authentication"]);
  // Shared concepts, each in its own context.
  assert.deepEqual(labels("attestations-in-identity"), ["Identity, Accounts & Authority", "Identity", "Attestations"]);
  assert.deepEqual(labels("attestations"), ["State & Data", "Provenance", "Attestations"]);
  assert.deepEqual(labels("signing-in-wallets"), ["Identity, Accounts & Authority", "Wallets", "Signing"]);
  assert.deepEqual(labels("transaction-submission-in-wallets"), ["Identity, Accounts & Authority", "Wallets", "Transaction Submission"]);
  for (const id of ["agent-identity", "paymasters", "attestations-in-identity", "signing-in-wallets"]) {
    assert.equal(resolveMapContextParam(index, [id]), id);
    assert.equal(getMapContextHref(id), `/map?context=${id}`);
  }
  assert.deepEqual([...getInitialMapExplorerState(view, "session-keys").expandedPlacementIds].sort(), ["identity-accounts-authority", "smart-accounts"]);
  const rows = getVisibleMapExplorerRows(view, new Set(mapKnowledge.placements.map((placement) => placement.id)));
  const subtreeRows = rows.filter((row) => getContainingMapL0(index, row.placementId) === "identity-accounts-authority" && row.depth > 0);
  assert.equal(subtreeRows.length, 8 + 47);
  assert.ok(subtreeRows.filter((row) => row.depth === 1).every((row) => row.isExpandable && row.hasChildren && !row.hasContent));
  // L2 topics are leaves; Agent Identity keeps its canonical exposition, so it opens.
  assert.ok(subtreeRows.filter((row) => row.depth === 2).every((row) => !row.hasChildren && row.hasContent === (row.conceptId === "agent-identity") && row.isExpandable === row.hasContent));
  for (const row of subtreeRows) {
    assert.equal(getContainingMapL0Ordinal(index, row.placementId), "08");
    assert.ok(row.depth <= 2, `${row.placementId} is at most L2`);
  }
});

test("Storage & Availability L2 topics are ordinary placements: context, ancestry, containing L0", () => {
  const index = indexMapExplorerView(view);
  const labels = (id: string) => getMapExplorerContext(index, id).map((step) => step.label);
  assert.deepEqual(labels("proof-of-retrievability"), ["Storage & Availability", "Storage Proofs", "Proof of Retrievability"]);
  assert.deepEqual(labels("light-client-sampling"), ["Storage & Availability", "Data Availability Sampling", "Light-Client Sampling"]);
  assert.deepEqual(labels("data-reconstruction"), ["Storage & Availability", "Erasure Coding", "Reconstruction"]);
  // Shared concepts, each in its own context.
  assert.deepEqual(labels("content-addressing-in-storage-availability"), ["Storage & Availability", "Content Addressing"]);
  assert.deepEqual(labels("content-addressing"), ["State & Data", "Off-Chain Data", "Content Addressing"]);
  assert.deepEqual(labels("fault-tolerance-in-distributed-storage"), ["Storage & Availability", "Distributed Storage", "Fault Tolerance"]);
  assert.deepEqual(labels("archive-nodes-in-archival-storage"), ["Storage & Availability", "Archival Storage", "Archive Nodes"]);
  assert.deepEqual(labels("proof-verification-in-storage-proofs"), ["Storage & Availability", "Storage Proofs", "Proof Verification"]);
  assert.deepEqual(labels("proof-verification"), ["Cryptography & Proofs", "Verifiable Computation", "Proof Verification"]);
  for (const id of ["blob-commitments", "content-addressing-in-storage-availability", "archive-nodes-in-archival-storage", "data-reconstruction"]) {
    assert.equal(resolveMapContextParam(index, [id]), id);
    assert.equal(getMapContextHref(id), `/map?context=${id}`);
  }
  assert.deepEqual([...getInitialMapExplorerState(view, "blob-pricing").expandedPlacementIds].sort(), ["blobs", "storage-availability"]);
  const rows = getVisibleMapExplorerRows(view, new Set(mapKnowledge.placements.map((placement) => placement.id)));
  const subtreeRows = rows.filter((row) => getContainingMapL0(index, row.placementId) === "storage-availability" && row.depth > 0);
  assert.equal(subtreeRows.length, 9 + 51);
  assert.ok(subtreeRows.filter((row) => row.depth === 1).every((row) => row.isExpandable && row.hasChildren && !row.hasContent));
  assert.ok(subtreeRows.filter((row) => row.depth === 2).every((row) => !row.isExpandable && !row.hasChildren && !row.hasContent));
  for (const row of subtreeRows) {
    assert.equal(getContainingMapL0Ordinal(index, row.placementId), "07");
    assert.ok(row.depth <= 2, `${row.placementId} is at most L2`);
  }
});

test("Cryptography & Proofs L2 topics are ordinary placements: context, ancestry, containing L0", () => {
  const index = indexMapExplorerView(view);
  const labels = (id: string) => getMapExplorerContext(index, id).map((step) => step.label);
  assert.deepEqual(labels("distributed-key-generation"), ["Cryptography & Proofs", "Threshold Cryptography", "Distributed Key Generation"]);
  assert.deepEqual(labels("privacy-preserving-protocols"), ["Cryptography & Proofs", "Privacy", "Privacy-Preserving Protocols"]);
  assert.deepEqual(labels("proof-carrying-computation"), ["Cryptography & Proofs", "Verifiable Computation", "Proof-Carrying Computation"]);
  // Contextual wording and shared concepts, each in its own context.
  assert.deepEqual(labels("hiding"), ["Cryptography & Proofs", "Commitments", "Hiding"]);
  assert.deepEqual(labels("commitment-schemes-in-cryptographic-commitments"), ["Cryptography & Proofs", "Commitments", "Commitment Schemes"]);
  assert.deepEqual(labels("commitment-schemes"), ["State & Data", "State Commitments", "Commitment Schemes"]);
  assert.deepEqual(labels("computation-proofs-in-cryptography-proofs"), ["Cryptography & Proofs", "Verifiable Computation", "Computation Proofs"]);
  assert.deepEqual(labels("computation-proofs"), ["Computation & Execution", "Verifiable Computation", "Computation Proofs"]);
  assert.deepEqual(labels("verifiable-computation-in-cryptography-proofs"), ["Cryptography & Proofs", "Verifiable Computation"]);
  assert.deepEqual(labels("verifiable-computation"), ["Computation & Execution", "Verifiable Computation"]);
  for (const id of ["snarks", "cryptographic-commitments", "computation-proofs-in-cryptography-proofs", "verifiable-computation-in-cryptography-proofs"]) {
    assert.equal(resolveMapContextParam(index, [id]), id);
    assert.equal(getMapContextHref(id), `/map?context=${id}`);
  }
  assert.deepEqual([...getInitialMapExplorerState(view, "witnesses").expandedPlacementIds].sort(), ["cryptography-proofs", "zero-knowledge-proofs"]);
  const rows = getVisibleMapExplorerRows(view, new Set(mapKnowledge.placements.map((placement) => placement.id)));
  const subtreeRows = rows.filter((row) => getContainingMapL0(index, row.placementId) === "cryptography-proofs" && row.depth > 0);
  assert.equal(subtreeRows.length, 8 + 48);
  assert.ok(subtreeRows.filter((row) => row.depth === 1).every((row) => row.isExpandable && row.hasChildren && !row.hasContent));
  assert.ok(subtreeRows.filter((row) => row.depth === 2).every((row) => !row.isExpandable && !row.hasChildren && !row.hasContent));
  for (const row of subtreeRows) {
    assert.equal(getContainingMapL0Ordinal(index, row.placementId), "06");
    assert.ok(row.depth <= 2, `${row.placementId} is at most L2`);
  }
});

test("Networks & Infrastructure L2 topics are ordinary placements: context, ancestry, containing L0", () => {
  const index = indexMapExplorerView(view);
  const labels = (id: string) => getMapExplorerContext(index, id).map((step) => step.label);
  assert.deepEqual(labels("duplicate-suppression"), ["Networks & Infrastructure", "Message Propagation", "Duplicate Suppression"]);
  assert.deepEqual(labels("event-driven-execution"), ["Networks & Infrastructure", "Automation", "Event-Driven Execution"]);
  // Contextual wording over shared or qualified concepts.
  assert.deepEqual(labels("synchronization-in-nodes"), ["Networks & Infrastructure", "Nodes", "Node Synchronization"]);
  assert.deepEqual(labels("automation-networks-in-keepers"), ["Networks & Infrastructure", "Keepers", "Keeper Networks"]);
  assert.deepEqual(labels("automation-networks"), ["Networks & Infrastructure", "Automation", "Automation Networks"]);
  assert.deepEqual(labels("system-logs"), ["Networks & Infrastructure", "Monitoring", "Logs"]);
  assert.deepEqual(labels("distributed-traces"), ["Networks & Infrastructure", "Monitoring", "Traces"]);
  assert.deepEqual(labels("reorganization-handling-in-indexers"), ["Networks & Infrastructure", "Indexers", "Reorganization Handling"]);
  // The same concepts in State & Data keep their own contexts.
  assert.deepEqual(labels("synchronization"), ["State & Data", "Synchronization"]);
  assert.deepEqual(labels("reorganization-handling"), ["State & Data", "Indexing", "Reorganization Handling"]);
  for (const id of ["synchronization-in-nodes", "automation-networks-in-keepers", "system-logs", "rpc-endpoints"]) {
    assert.equal(resolveMapContextParam(index, [id]), id);
    assert.equal(getMapContextHref(id), `/map?context=${id}`);
  }
  assert.deepEqual([...getInitialMapExplorerState(view, "bootnodes").expandedPlacementIds].sort(), ["networks-infrastructure", "nodes"]);
  const rows = getVisibleMapExplorerRows(view, new Set(mapKnowledge.placements.map((placement) => placement.id)));
  const subtreeRows = rows.filter((row) => getContainingMapL0(index, row.placementId) === "networks-infrastructure" && row.depth > 0);
  assert.equal(subtreeRows.length, 10 + 58);
  assert.ok(subtreeRows.filter((row) => row.depth === 1).every((row) => row.isExpandable && row.hasChildren && !row.hasContent));
  assert.ok(subtreeRows.filter((row) => row.depth === 2).every((row) => !row.isExpandable && !row.hasChildren && !row.hasContent));
  for (const row of subtreeRows) {
    assert.equal(getContainingMapL0Ordinal(index, row.placementId), "05");
    assert.ok(row.depth <= 2, `${row.placementId} is at most L2`);
  }
});

test("Consensus & Ordering L2 topics are ordinary placements: context, ancestry, containing L0", () => {
  const index = indexMapExplorerView(view);
  const labels = (id: string) => getMapExplorerContext(index, id).map((step) => step.label);
  assert.deepEqual(labels("checkpoints"), ["Consensus & Ordering", "Finality", "Checkpoints"]);
  assert.deepEqual(labels("preconfirmation-guarantees"), ["Consensus & Ordering", "Preconfirmations", "Preconfirmation Guarantees"]);
  assert.deepEqual(labels("inclusion-lists"), ["Consensus & Ordering", "Censorship Resistance", "Inclusion Lists"]);
  assert.deepEqual(labels("proposers-in-validators"), ["Consensus & Ordering", "Validators", "Proposers"]);
  assert.deepEqual(labels("proposers-in-proposer-builder-separation"), ["Consensus & Ordering", "Proposer-Builder Separation", "Proposers"]);
  assert.deepEqual(labels("transaction-ordering-in-block-building"), ["Consensus & Ordering", "Block Building", "Transaction Ordering"]);
  // The same concepts elsewhere keep their own contexts.
  assert.deepEqual(labels("censorship-resistance"), ["Foundations", "Protocol Properties", "Censorship Resistance"]);
  assert.deepEqual(labels("transaction-ordering"), ["Computation & Execution", "Transactions", "Transaction Ordering"]);
  for (const id of ["checkpoints", "proposers-in-proposer-builder-separation", "censorship-resistance-in-consensus-ordering", "finality-in-consensus"]) {
    assert.equal(resolveMapContextParam(index, [id]), id);
    assert.equal(getMapContextHref(id), `/map?context=${id}`);
  }
  assert.equal(resolveMapContextParam(index, ["proposers"]), null);
  assert.deepEqual([...getInitialMapExplorerState(view, "justification").expandedPlacementIds].sort(), ["consensus-ordering", "finality-in-consensus"]);
  const rows = getVisibleMapExplorerRows(view, new Set(mapKnowledge.placements.map((placement) => placement.id)));
  const subtreeRows = rows.filter((row) => getContainingMapL0(index, row.placementId) === "consensus-ordering" && row.depth > 0);
  assert.equal(subtreeRows.length, 10 + 58);
  // Finality carries its canonical exposition as well as its layer; everything else here has none.
  assert.ok(subtreeRows.filter((row) => row.depth === 1).every((row) => row.isExpandable && row.hasChildren && row.hasContent === (row.conceptId === "finality")));
  assert.ok(subtreeRows.filter((row) => row.depth === 2).every((row) => !row.isExpandable && !row.hasChildren && !row.hasContent));
  for (const row of subtreeRows) {
    assert.equal(getContainingMapL0Ordinal(index, row.placementId), "04");
    assert.ok(row.depth <= 2, `${row.placementId} is at most L2`);
  }
});

test("State & Data L2 topics are ordinary placements: context, ancestry, containing L0", () => {
  const index = indexMapExplorerView(view);
  const labels = (id: string) => getMapExplorerContext(index, id).map((step) => step.label);
  assert.deepEqual(labels("synchronization-verification"), ["State & Data", "Synchronization", "Synchronization Verification"]);
  assert.deepEqual(labels("reorganization-handling"), ["State & Data", "Indexing", "Reorganization Handling"]);
  // Contextual wording: Foundations' Transitions is "State Transitions" here; State Checkpoints is "Checkpoints".
  assert.deepEqual(labels("atomic-state-transitions"), ["State & Data", "State Transitions", "Atomic State Transitions"]);
  assert.deepEqual(labels("state-checkpoints"), ["State & Data", "Historical State", "Checkpoints"]);
  // One State Roots concept, two contexts.
  assert.deepEqual(labels("state-roots-in-state-representation"), ["State & Data", "State Representation", "State Roots"]);
  assert.deepEqual(labels("state-roots-in-state-commitments"), ["State & Data", "State Commitments", "State Roots"]);
  for (const id of ["merkle-patricia-tries", "state-roots-in-state-commitments", "transitions-in-state-data", "content-addressing"]) {
    assert.equal(resolveMapContextParam(index, [id]), id);
    assert.equal(getMapContextHref(id), `/map?context=${id}`);
  }
  // Placement, not concept: neither shared concept resolves as a context by its concept id.
  assert.equal(resolveMapContextParam(index, ["state-roots"]), null);
  assert.deepEqual([...getInitialMapExplorerState(view, "valid-transitions").expandedPlacementIds].sort(), ["state-data", "transitions-in-state-data"]);
  const rows = getVisibleMapExplorerRows(view, new Set(mapKnowledge.placements.map((placement) => placement.id)));
  const subtreeRows = rows.filter((row) => getContainingMapL0(index, row.placementId) === "state-data" && row.depth > 0);
  assert.equal(subtreeRows.length, 10 + 59);
  assert.ok(subtreeRows.filter((row) => row.depth === 1).every((row) => row.isExpandable && row.hasChildren && !row.hasContent));
  assert.ok(subtreeRows.filter((row) => row.depth === 2).every((row) => !row.isExpandable && !row.hasChildren && !row.hasContent));
  for (const row of subtreeRows) {
    assert.equal(getContainingMapL0Ordinal(index, row.placementId), "03");
    assert.ok(row.depth <= 2, `${row.placementId} is at most L2`);
  }
});

test("Computation & Execution L2 topics are ordinary placements: context, ancestry, containing L0", () => {
  const index = indexMapExplorerView(view);
  const labels = (id: string) => getMapExplorerContext(index, id).map((step) => step.label);
  assert.deepEqual(labels("denial-of-service-resistance"), ["Computation & Execution", "Resource Accounting", "Denial-of-Service Resistance"]);
  assert.deepEqual(labels("non-deterministic-execution"), ["Computation & Execution", "Execution Models", "Non-Deterministic Execution"]);
  assert.deepEqual(labels("zkvms"), ["Computation & Execution", "Virtual Machines", "zkVMs"]);
  // Contextual wording: the concept is Contract Deployment, shown as Deployment here.
  assert.deepEqual(labels("contract-deployment"), ["Computation & Execution", "Smart Contracts", "Deployment"]);
  assert.deepEqual(labels("verification-in-verifiable-computation"), ["Computation & Execution", "Verifiable Computation", "Verification"]);
  // One concept, two placements, two contexts.
  assert.deepEqual(labels("verification"), ["Foundations", "Trust Models", "Verification"]);
  for (const id of ["transaction-reversion", "zkvms", "contract-deployment", "verification-in-verifiable-computation"]) {
    assert.equal(resolveMapContextParam(index, [id]), id);
    assert.equal(getMapContextHref(id), `/map?context=${id}`);
  }
  assert.deepEqual([...getInitialMapExplorerState(view, "gas").expandedPlacementIds].sort(), ["computation-execution", "resource-accounting"]);
  // L1 topics open onto their topics; L2 topics are leaves (Verification has no exposition yet).
  const rows = getVisibleMapExplorerRows(view, new Set(mapKnowledge.placements.map((placement) => placement.id)));
  const subtreeRows = rows.filter((row) => getContainingMapL0(index, row.placementId) === "computation-execution" && row.depth > 0);
  assert.equal(subtreeRows.length, 7 + 39);
  assert.ok(subtreeRows.filter((row) => row.depth === 1).every((row) => row.isExpandable && row.hasChildren && !row.hasContent));
  assert.ok(subtreeRows.filter((row) => row.depth === 2).every((row) => !row.isExpandable && !row.hasChildren && !row.hasContent));
  for (const row of subtreeRows) {
    assert.equal(getContainingMapL0Ordinal(index, row.placementId), "02");
    assert.ok(row.depth <= 2, `${row.placementId} is at most L2`);
  }
});

test("Foundations L2 topics are ordinary placements: context, ancestry, containing L0", () => {
  const index = indexMapExplorerView(view);
  const labels = (id: string) => getMapExplorerContext(index, id).map((step) => step.label);
  assert.deepEqual(labels("state-machine-replication"), ["Foundations", "State Machines", "State Machine Replication"]);
  assert.deepEqual(labels("censorship-resistance"), ["Foundations", "Protocol Properties", "Censorship Resistance"]);
  assert.deepEqual(labels("state-in-protocols"), ["Foundations", "Protocols", "State"]);
  assert.deepEqual(labels("state-in-state-machines"), ["Foundations", "State Machines", "State"]);
  assert.deepEqual(labels("coordination-communication"), ["Foundations", "Coordination", "Communication"]);
  assert.deepEqual(labels("finality-in-protocol-properties"), ["Foundations", "Protocol Properties", "Finality"]);
  for (const id of ["state-machine-replication", "state-in-protocols", "coordination-communication", "finality-in-protocol-properties"]) {
    assert.equal(resolveMapContextParam(index, [id]), id);
    assert.equal(getMapContextHref(id), `/map?context=${id}`);
  }
  // Placement, not concept: State resolves per placement, never by concept id.
  assert.equal(resolveMapContextParam(index, ["state"]), null);
  // Entering an L2 context opens exactly its ancestry.
  assert.deepEqual([...getInitialMapExplorerState(view, "state-in-state-machines").expandedPlacementIds].sort(), ["foundations", "state-machines"]);
  // Every placement in the subtree sits in 01 Foundations.
  const subtree = mapKnowledge.placements.filter((placement) => getMapExplorerContext(index, placement.id).length > 1 && getMapExplorerContext(index, placement.id)[0].placementId === "foundations");
  assert.equal(subtree.length, 7 + 43);
  for (const placement of subtree) {
    assert.equal(getContainingMapL0(index, placement.id), "foundations");
    assert.equal(getContainingMapL0Ordinal(index, placement.id), "01");
    assert.ok(getMapExplorerContext(index, placement.id).length <= 3, `${placement.id} is at most L2`);
  }
});

test("the explorer view carries only a content flag, never exposition text", () => {
  const serialized = JSON.stringify(view);
  for (const content of mapKnowledge.content) {
    assert.ok(!serialized.includes(content.definition), content.conceptId);
    for (const block of content.body ?? []) {
      if (block.kind === "paragraph") assert.ok(!serialized.includes(block.text), content.conceptId);
    }
  }
  assert.ok(serialized.includes('"hasContent":true'));
});

test("exposition is normalized to ordered blocks: definition leads, no labelled scaffolding", () => {
  const finality = mapKnowledge.content.find((content) => content.conceptId === "finality")!;
  const exposition = toMapConceptExposition(finality);
  assert.deepEqual(exposition.blocks, [
    { kind: "paragraph", text: finality.definition },
    { kind: "paragraph", text: finality.summary },
    { kind: "paragraph", text: finality.whyItMatters },
  ]);
  const foundations = toMapConceptExposition(mapKnowledge.content.find((content) => content.conceptId === "foundations")!);
  assert.equal(foundations.blocks[0].kind, "paragraph");
  assert.equal(foundations.blocks.length, 1 + (mapKnowledge.content[0].body?.length ?? 0));
  assert.equal(getMapConceptContentHref("foundations"), "/api/map/content/foundations");
});

test("the /map domain index is the canonical 27 L0 entries, identical to the homepage's", () => {
  const entries = getMapL0IndexEntries(view);
  assert.equal(entries.length, 27);
  assert.deepEqual(entries, getMapL0Entries(resolver));
  assert.deepEqual(entries.map((entry) => entry.ordinal), Array.from({ length: 27 }, (_, i) => String(i + 1).padStart(2, "0")));
  for (const entry of entries) {
    assert.equal(entry.href, `/map?context=${entry.placementId}`);
    // Navigation entries only: no disclosure state of their own.
    assert.deepEqual(Object.keys(entry).sort(), ["conceptId", "href", "label", "ordinal", "placementId"]);
  }
});

test("entering a domain from the index sets context, opens it, and never collapses it", () => {
  const index = indexMapExplorerView(view);
  const closed = enterMapExplorerContext("foundations", new Set(), index);
  assert.equal(closed.contextPlacementId, "foundations");
  assert.deepEqual([...closed.expandedPlacementIds], ["foundations"]);
  assert.equal(closed.reveal, true);
  // Already open (unlike activating the open row): stays open.
  const open = new Set(["foundations", "scaling-modular-systems"]);
  const again = enterMapExplorerContext("foundations", open, index);
  assert.equal(again.expandedPlacementIds, open);
  // An empty domain is entered without fabricated disclosure.
  assert.deepEqual([...enterMapExplorerContext("autonomous-organizations", new Set(), index).expandedPlacementIds], []);
  assert.equal(getMapContextHref(closed.contextPlacementId), "/map?context=foundations");
});

test("the containing L0 domain comes from placement ancestry", () => {
  const index = indexMapExplorerView(view);
  assert.equal(getContainingMapL0(index, "foundations"), "foundations");
  assert.equal(getContainingMapL0(index, "protocols"), "foundations");
  assert.equal(getContainingMapL0(index, "finality-in-consensus"), "consensus-ordering");
  assert.equal(getContainingMapL0(index, "finality-in-rollups"), "scaling-modular-systems");
  assert.equal(getContainingMapL0(index, null), null);
});

test("the breadcrumb's ordinal is the containing L0's canonical ordinal, for any depth", () => {
  const index = indexMapExplorerView(view);
  const canonical = new Map(getMapL0Entries(resolver).map((entry) => [entry.placementId, entry.ordinal]));
  assert.equal(getContainingMapL0Ordinal(index, "foundations"), "01");
  assert.equal(getContainingMapL0Ordinal(index, "protocols"), "01");
  assert.equal(getContainingMapL0Ordinal(index, "identity-accounts-authority"), "08");
  assert.equal(getContainingMapL0Ordinal(index, "agent-identity"), "08");
  assert.equal(getContainingMapL0Ordinal(index, "finality-in-rollups"), "15");
  assert.equal(getContainingMapL0Ordinal(index, "frontier-systems"), "27");
  assert.equal(getContainingMapL0Ordinal(index, null), null);
  // Same coordinate as the homepage and /map index for every placement.
  for (const placement of mapKnowledge.placements) {
    assert.equal(getContainingMapL0Ordinal(index, placement.id), canonical.get(getContainingMapL0(index, placement.id)!));
  }
});
