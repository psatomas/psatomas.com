import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { mapKnowledge } from "../data.ts";
import { createMapResolver } from "../resolver.ts";
import type { MapKnowledgeModel } from "../types.ts";
import { createMapAuthoringInspector, MapAuthoringContextError } from "./context.ts";
import type { MapAuthoringErrorCode } from "./context.ts";
import { formatMapConceptAuthoringContext, formatMapDomainAuthoringStatus } from "./format.ts";

const inspector = createMapAuthoringInspector(mapKnowledge);
const resolver = createMapResolver(mapKnowledge);
const ids = (refs: readonly { placementId: string }[]) => refs.map((entry) => entry.placementId);

function assertFailsWith(code: MapAuthoringErrorCode, run: () => unknown, message: RegExp) {
  assert.throws(run, (error: unknown) => {
    assert.ok(error instanceof MapAuthoringContextError);
    assert.equal(error.code, code);
    assert.match(error.message, message);
    return true;
  });
}

test("a single-placement L1 topic resolves its placement, parent section, siblings and children", () => {
  const context = inspector.inspectConcept("distributed-systems");
  assert.deepEqual(context.concept, { id: "distributed-systems", title: "Distributed Systems" });
  assert.equal(context.content.exists, false);
  assert.equal(context.primaryPlacementId, "distributed-systems");
  assert.equal(context.primarySource, "preferred");
  assert.deepEqual(context.levels, ["L1"]);
  assert.equal(context.placements.length, 1);
  const [placement] = context.placements;
  assert.equal(placement.level, "L1");
  assert.ok(placement.isPrimary && placement.isPreferred);
  assert.equal(placement.domainOrdinal, "01");
  assert.deepEqual(placement.trail.map((step) => step.label), ["Foundations", "Distributed Systems"]);
  assert.equal(placement.parent?.placementId, "foundations");
  assert.equal(placement.parent?.hasContent, true);
  // Siblings and children follow the resolver's sibling order.
  assert.deepEqual(ids(placement.siblings), resolver.getChildren("foundations").map((placement) => placement.id));
  assert.deepEqual(ids(placement.children), ["processes", "communication", "partial-knowledge", "latency", "failures", "fault-models"]);
  // The parent's section for this topic is the one whose strip names its children.
  assert.equal(placement.parent?.section?.heading, "No participant can assume it sees the whole system");
  assert.equal(placement.parent?.section?.lines.at(-1), "[terms] Processes · Communication · Partial knowledge · Latency · Failures · Fault models");
  assert.deepEqual(context.attention, []);
});

test("a concept placed at L1 and L2 reports both roles and which placement carries its layer", () => {
  const context = inspector.inspectConcept("protocol-properties");
  assert.deepEqual(context.levels, ["L1", "L2"]);
  assert.deepEqual(context.placements.map((placement) => [placement.placementId, placement.level, placement.isPrimary]), [
    ["protocol-properties", "L1", true],
    ["protocol-properties-in-protocols", "L2", false],
  ]);
  assert.deepEqual(ids(context.placements[1].children), []);
  assert.equal(context.placements[1].parent?.placementId, "protocols");
  const finality = context.placements[0].children.find((child) => child.conceptId === "finality");
  assert.ok(finality?.hasContent && finality.conceptPlacementCount === 4);
  assert.ok(context.attention.some((note) => note.startsWith("Placed at L1 and L2")));
  assert.ok(context.attention.some((note) => note.startsWith("Only protocol-properties carries the concept's children")));
  assert.ok(context.attention.some((note) => note.startsWith("Children with their own exposition: finality.")));
});

test("an explicit context becomes primary; other placements follow by domain order", () => {
  const context = inspector.inspectConcept("finality", { contextPlacementId: "finality-in-rollups" });
  assert.equal(context.primarySource, "explicit");
  assert.equal(context.primaryPlacementId, "finality-in-rollups");
  assert.equal(context.preferredPlacementId, "finality-in-consensus");
  assert.deepEqual(ids(context.placements), [
    "finality-in-rollups",
    "finality-in-protocol-properties",
    "finality-in-consensus",
    "finality-in-cross-chain-verification",
  ]);
  assert.deepEqual(context.placements.map((placement) => placement.level), ["L2", "L2", "L1", "L2"]);
  assert.equal(context.placements.find((placement) => placement.isPreferred)?.placementId, "finality-in-consensus");
  assert.equal(context.placements[0].contextualNote, "Finality as a settlement property relevant to rollup systems.");
  assert.equal(context.content.exists, true);
  assert.equal(context.content.lines[0], "The point at which a protocol treats a result as no longer practically reversible.");
  assert.deepEqual(context.relationships.map((relation) => [relation.direction, relation.label, relation.conceptId]), [
    ["outgoing", "finalizes", "settlement"],
    ["incoming", "is depended on by", "rollups"],
  ]);
  assert.deepEqual(context.mechanisms, [{ id: "consensus-to-finality", title: "Consensus to Finality", role: "owner" }]);
  assert.ok(context.attention.includes('The selected context "finality-in-rollups" is not the preferred placement "finality-in-consensus".'));
  // Without a context the preferred placement leads.
  assert.equal(inspector.inspectConcept("finality").placements[0].placementId, "finality-in-consensus");
});

test("a preferred leaf placement points the author at the placement that carries the layer", () => {
  const context = inspector.inspectConcept("transitions");
  assert.equal(context.primaryPlacementId, "transitions");
  assert.equal(context.placements[1].contextualLabel, "State Transitions");
  assert.ok(context.attention.some((note) => note.includes("inspect with --context transitions-in-state-data")));
  const layer = inspector.inspectConcept("transitions", { contextPlacementId: "transitions-in-state-data" });
  assert.equal(layer.placements[0].level, "L1");
  assert.ok(layer.placements[0].children.length > 0);
  assert.equal(inspector.inspectDomain("state-data").l1.find((entry) => entry.conceptId === "transitions")?.preferredElsewhere, "transitions");
});

test("distinct concepts sharing a title are reported, never merged", () => {
  assert.deepEqual(inspector.inspectConcept("communication").sameTitleConcepts, ["coordination-communication"]);
  assert.deepEqual(inspector.inspectConcept("coordination-communication").sameTitleConcepts, ["communication"]);
});

test("inspection fails clearly for unknown concepts, contexts, domains and invalid data", () => {
  assertFailsWith("unknown-concept", () => inspector.inspectConcept("no-such-concept"), /Unknown MAP concept "no-such-concept"/);
  assertFailsWith("unknown-concept", () => inspector.inspectConcept("finality-in-rollups"), /placement of concept "finality"/);
  assertFailsWith("unknown-context", () => inspector.inspectConcept("finality", { contextPlacementId: "nowhere" }), /Unknown placement "nowhere"/);
  assertFailsWith("context-mismatch", () => inspector.inspectConcept("finality", { contextPlacementId: "consensus" }), /belongs to concept "consensus", not "finality"/);
  assertFailsWith("unknown-domain", () => inspector.inspectDomain("protocols"), /Unknown L0 domain "protocols"/);
  const invalid: MapKnowledgeModel = { ...mapKnowledge, placements: [...mapKnowledge.placements, { id: "orphan", conceptId: "missing", order: 99 }] };
  assertFailsWith("invalid-model", () => createMapAuthoringInspector(invalid), /structurally invalid[\s\S]*missing concept "missing"/);
});

test("sibling and child order is the explicit sibling order, whatever the record order", () => {
  const concept = (id: string) => ({ id, slug: id, title: id.toUpperCase() });
  const model: MapKnowledgeModel = {
    concepts: ["root", "b", "a", "c", "leaf-2", "leaf-1"].map(concept),
    placements: [
      { id: "c", conceptId: "c", parentPlacementId: "root", order: 2 },
      { id: "leaf-2", conceptId: "leaf-2", parentPlacementId: "a", order: 1 },
      { id: "a", conceptId: "a", parentPlacementId: "root", order: 0 },
      { id: "root", conceptId: "root", order: 0 },
      { id: "leaf-1", conceptId: "leaf-1", parentPlacementId: "a", order: 0 },
      { id: "b", conceptId: "b", parentPlacementId: "root", order: 1 },
    ],
    relationships: [],
    content: [],
    mechanisms: [],
    knowledgePaths: [],
  };
  const context = createMapAuthoringInspector(model).inspectConcept("a");
  assert.deepEqual(ids(context.placements[0].siblings), ["a", "b", "c"]);
  assert.deepEqual(ids(context.placements[0].children), ["leaf-1", "leaf-2"]);
  assert.equal(context.placements[0].parent?.hasContent, false);
  assert.ok(context.attention.includes('The parent "root" has no exposition yet.'));
});

test("inspection and its text output are deterministic", () => {
  const fresh = createMapAuthoringInspector(mapKnowledge);
  for (const conceptId of ["distributed-systems", "finality", "agent-identity", "state"]) {
    assert.deepEqual(fresh.inspectConcept(conceptId), inspector.inspectConcept(conceptId), conceptId);
    assert.equal(formatMapConceptAuthoringContext(fresh.inspectConcept(conceptId)), formatMapConceptAuthoringContext(inspector.inspectConcept(conceptId)));
  }
  const text = formatMapConceptAuthoringContext(inspector.inspectConcept("distributed-systems"));
  assert.match(text, /^MAP authoring context: Distributed Systems \(distributed-systems\)\n/);
  assert.match(text, /\n {2}L1 {2}distributed-systems {2}\(primary authoring context, preferred\)\n/);
  assert.match(text, /trail: {4}01 Foundations \/ Distributed Systems\n/);
  assert.match(text, /> distributed-systems/);
});

test("domain status lists L1 topics in sibling order with their content status", () => {
  const status = inspector.inspectDomain("foundations");
  assert.equal(status.domainOrdinal, "01");
  assert.deepEqual(ids(status.l1), resolver.getChildren("foundations").map((placement) => placement.id));
  const properties = status.l1.find((entry) => entry.placementId === "protocol-properties")!;
  assert.deepEqual([properties.levels, properties.childCount, properties.childrenWithContent], [["L1", "L2"], 7, 1]);
  assert.match(formatMapDomainAuthoringStatus(status), /^MAP authoring status: 01 Foundations \(foundations\) — domain exposition: yes\nL1 topics with canonical content: 0 of 7\n/);
});

test("authoring tooling stays out of the MAP runtime", () => {
  const runtime = ["src/app", "src/components"].flatMap((dir) =>
    readdirSync(new URL(`../../../../${dir}/`, import.meta.url), { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.(ts|tsx)$/.test(entry.name))
      .map((entry) => `${entry.parentPath}/${entry.name}`),
  );
  assert.ok(runtime.length > 0);
  for (const file of runtime) assert.ok(!readFileSync(file, "utf8").includes("map/authoring"), file);
});
