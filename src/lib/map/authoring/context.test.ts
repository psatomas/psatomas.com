import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { mapKnowledge } from "../data.ts";
import { createMapResolver } from "../resolver.ts";
import type { MapContentBlock, MapKnowledgeModel } from "../types.ts";
import { createMapAuthoringInspector, MapAuthoringContextError } from "./context.ts";
import { AUTHORED_CONTENT_CONCEPTS } from "./content-registry.ts";
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
  // Content status follows the authored-content registry, whatever has been authored.
  assert.equal(context.content.exists, AUTHORED_CONTENT_CONCEPTS.includes("distributed-systems"));
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
  // A single placement at one level raises nothing about placement roles.
  assert.deepEqual(context.attention.filter((note) => !note.startsWith("Canonical content")), []);
});

/** A root with three topics, whose exposition follows the L0 section convention. */
function sectionedModel(body: MapContentBlock[]): MapKnowledgeModel {
  const concept = (id: string) => ({ id, slug: id, title: id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) });
  const topics = ["alpha", "beta", "gamma"];
  const children = topics.flatMap((topic) => [`${topic}-one`, `${topic}-two`]);
  return {
    concepts: ["domain", ...topics, ...children].map(concept),
    placements: [
      { id: "domain", conceptId: "domain", order: 0 },
      ...topics.map((id, order) => ({ id, conceptId: id, parentPlacementId: "domain", order })),
      ...children.map((id) => ({ id, conceptId: id, parentPlacementId: id.split("-")[0], order: id.endsWith("one") ? 0 : 1 })),
    ],
    relationships: [],
    content: [{ id: "domain-content", conceptId: "domain", definition: "A domain.", body }],
    mechanisms: [],
    knowledgePaths: [],
  };
}

const SECTIONS: MapContentBlock[] = [
  { kind: "paragraph", text: "Domain introduction." },
  { kind: "heading", text: "Alpha opens the domain" },
  { kind: "paragraph", text: "Alpha explained." },
  { kind: "terms", terms: ["Alpha One", "Alpha Two"] },
  { kind: "heading", text: "Beta sits in the middle" },
  { kind: "paragraph", text: "Beta explained." },
  { kind: "terms", terms: ["Beta One", "Beta Two"] },
  { kind: "paragraph", text: "Beta continues after its strip." },
  { kind: "heading", text: "Gamma closes the topics" },
  { kind: "paragraph", text: "Gamma explained." },
  { kind: "distinction", left: "Gamma", right: "Beta" },
  { kind: "terms", terms: ["Gamma One", "Gamma Two"] },
];
const sectionOf = (model: MapKnowledgeModel, topic: string) =>
  createMapAuthoringInspector(model).inspectConcept(topic).placements[0].parent?.section;

test("parent sections: a middle section is its whole heading-delimited span", () => {
  const model = sectionedModel([...SECTIONS, { kind: "paragraph", text: "Domain closing." }, { kind: "terms", terms: ["Alpha", "Beta", "Gamma"] }]);
  assert.deepEqual(sectionOf(model, "beta"), {
    index: 2,
    heading: "Beta sits in the middle",
    lines: ["## Beta sits in the middle", "Beta explained.", "[terms] Beta One · Beta Two", "Beta continues after its strip."],
  });
});

test("parent sections: the final section ends at its own strip, before the parent's closing material", () => {
  const gamma = ["## Gamma closes the topics", "Gamma explained.", "[distinction] Gamma ≠ Beta", "[terms] Gamma One · Gamma Two"];
  const summary: MapContentBlock = { kind: "terms", terms: ["Alpha", "Beta", "Gamma"] };
  for (const closing of [
    [{ kind: "paragraph", text: "Domain closing." }, { kind: "tensions", label: "Forces", pairs: [["Alpha", "Gamma"]] }],
    // Closing material under a heading of its own is still closing material.
    [{ kind: "heading", text: "What the domain adds up to" }, { kind: "paragraph", text: "Domain closing." }],
    [],
  ] as MapContentBlock[][]) {
    const model = sectionedModel([...SECTIONS, ...closing, summary]);
    assert.deepEqual(sectionOf(model, "gamma")?.lines, gamma, JSON.stringify(closing));
    assert.equal(sectionOf(model, "alpha")?.lines.at(-1), "[terms] Alpha One · Alpha Two");
  }
});

test("parent sections: without a closing summary strip nothing is truncated", () => {
  const model = sectionedModel([...SECTIONS, { kind: "paragraph", text: "Gamma continues after its strip." }]);
  assert.equal(sectionOf(model, "gamma")?.lines.at(-1), "Gamma continues after its strip.");
});

test("parent sections: an exposition without headings is the context as a whole, definition first", () => {
  const body: MapContentBlock[] = [{ kind: "paragraph", text: "Alpha's model." }, { kind: "distinction", left: "Alpha One", right: "Alpha Two" }];
  const sectioned = sectionedModel(SECTIONS);
  const model = { ...sectioned, content: [...sectioned.content, { id: "alpha-content", conceptId: "alpha", definition: "Alpha is a topic.", body }] };
  const context = createMapAuthoringInspector(model, { authoredContent: ["domain", "alpha"] }).inspectConcept("alpha-one");
  assert.deepEqual(context.placements[0].parent?.section, { index: 0, whole: true, lines: ["Alpha is a topic.", "Alpha's model.", "[distinction] Alpha One ≠ Alpha Two"] });
  assert.match(formatMapConceptAuthoringContext(context), /Alpha, whole exposition \(it has no sections\):\n\s+Alpha is a topic\./);
  // A sectioned (L0) parent is still divided among its children.
  assert.equal(sectionOf(model, "alpha")?.whole, undefined);
});

test("parent sections in the L0 corpus never absorb a domain's closing summary", () => {
  for (const root of resolver.getRootPlacements()) {
    const topics = resolver.getChildren(root.id);
    const summary = `[terms] ${topics.map((topic) => inspector.inspectConcept(topic.conceptId, { contextPlacementId: topic.id }).placements[0].label).join(" · ")}`;
    for (const topic of topics) {
      const section = inspector.inspectConcept(topic.conceptId, { contextPlacementId: topic.id }).placements[0].parent?.section;
      assert.ok(section, `${topic.id}: its section in ${root.id} is located`);
      assert.ok(!section.lines.includes(summary), `${topic.id}: section excludes the domain summary`);
    }
    // The last topic's section still runs from its heading through its own strip.
    const last = inspector.inspectConcept(topics.at(-1)!.conceptId, { contextPlacementId: topics.at(-1)!.id }).placements[0];
    assert.ok(last.parent?.section?.lines.at(-1)?.startsWith("[terms] "), `${root.id}: last section ends at its strip`);
  }
  // Foundations' last section keeps its own models and ends before the recurring tensions.
  const properties = inspector.inspectConcept("protocol-properties").placements[0].parent?.section;
  assert.equal(properties?.heading, "Properties belong to the system, not its components");
  assert.deepEqual(properties?.lines.filter((line) => line.startsWith("[")).map((line) => line.split(" ")[0]), ["[distinction]", "[flow]", "[terms]"]);
  assert.equal(properties?.lines.at(-1), "[terms] Safety · Liveness · Finality · Availability · Consistency · Fault tolerance · Censorship resistance");
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
  // The note lists exactly the children that own exposition, whatever the corpus has authored; Finality is one.
  const authoredChildren = context.placements[0].children.filter((child) => child.hasContent).map((child) => child.conceptId);
  assert.ok(authoredChildren.includes("finality"));
  assert.ok(context.attention.includes(`Children with their own exposition: ${authoredChildren.join(", ")}. Relate to them; do not restate them.`));
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

test("registration guidance follows the concept's content and registry state", () => {
  const constraints = (context: ReturnType<typeof inspector.inspectConcept>) =>
    formatMapConceptAuthoringContext(context).split("\nAuthoring constraints\n")[1];

  // No content, not registered: new exposition must be registered. (A synthetic
  // model keeps these states independent of what the real corpus has authored.)
  const fresh = createMapAuthoringInspector(sectionedModel(SECTIONS), { authoredContent: ["domain"] }).inspectConcept("alpha");
  assert.equal(fresh.registration, "unregistered");
  assert.match(constraints(fresh), /must also register "alpha" in AUTHORED_CONTENT_CONCEPTS/);

  // Content and registration agree: revising needs no new entry.
  const existing = inspector.inspectConcept("finality");
  assert.equal(existing.registration, "registered");
  assert.match(constraints(existing), /"finality" is already registered in AUTHORED_CONTENT_CONCEPTS \(src\/lib\/map\/authoring\/content-registry.ts\); revising its exposition needs no new registry entry/);
  assert.doesNotMatch(constraints(existing), /must also register/);
  assert.ok(!existing.attention.some((note) => note.startsWith("Registry inconsistency")));

  // Content without registration, and registration without content, are surfaced instead of normal guidance.
  const unregisteredFinality = createMapAuthoringInspector(mapKnowledge, {
    authoredContent: AUTHORED_CONTENT_CONCEPTS.filter((id) => id !== "finality"),
  }).inspectConcept("finality");
  assert.equal(unregisteredFinality.registration, "content-not-registered");
  assert.match(unregisteredFinality.attention[0], /^Registry inconsistency: "finality" owns content "finality-content" but is not registered/);
  const registeredEmpty = createMapAuthoringInspector(sectionedModel(SECTIONS), { authoredContent: ["domain", "alpha"] }).inspectConcept("alpha");
  assert.equal(registeredEmpty.registration, "registered-without-content");
  assert.match(registeredEmpty.attention[0], /^Registry inconsistency: "alpha" is registered .* but owns no content/);
  for (const context of [unregisteredFinality, registeredEmpty]) {
    const text = constraints(context);
    assert.match(text, /^ {2}- Do not author yet: /);
    assert.doesNotMatch(text, /must also register|already registered|Revising edits|body blocks|Flows need/);
    assert.match(formatMapConceptAuthoringContext(context), /\nRegistration: {7}INCONSISTENT: /);
  }
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
  const authoredChildren = resolver.getChildren("protocol-properties").filter((child) => AUTHORED_CONTENT_CONCEPTS.includes(child.conceptId)).length;
  assert.deepEqual([properties.levels, properties.childCount, properties.childrenWithContent], [["L1", "L2"], 7, authoredChildren]);
  const authored = status.l1.filter((entry) => AUTHORED_CONTENT_CONCEPTS.includes(entry.conceptId)).length;
  assert.deepEqual(status.l1.map((entry) => entry.hasContent), status.l1.map((entry) => AUTHORED_CONTENT_CONCEPTS.includes(entry.conceptId)));
  assert.ok(formatMapDomainAuthoringStatus(status).startsWith(`MAP authoring status: 01 Foundations (foundations) — domain exposition: yes\nL1 topics with canonical content: ${authored} of 7\n`));
});

/**
 * Two domains (d1 before d2). Concept "c" carries a layer under each: d1/c
 * (children a, b, s) and d2/c-in-d2 (children x, s, y), preferred in d2, and
 * is also a leaf under d2/p. "single" carries one layer and is a leaf
 * elsewhere. Options vary sharing, leaves, preference and child content.
 */
function facetModel({ shared = true, leaf = true, preferred = "c-in-d2", authoredChild }: { shared?: boolean; leaf?: boolean; preferred?: string; authoredChild?: string } = {}): MapKnowledgeModel {
  const titles: Record<string, string> = { d1: "Domain One", d2: "Domain Two", c: "Concept", p: "Parent Topic", a: "Alpha", b: "Beta", s: "Shared", x: "Xray", y: "Yankee", z: "Zulu", single: "Single", q: "Quebec", r: "Romeo" };
  const concept = (id: string) => ({ id, slug: id, title: titles[id], ...(id === "c" ? { preferredPlacementId: preferred } : {}), ...(id === "single" ? { preferredPlacementId: "single" } : {}) });
  const secondLayer = shared ? ["x", "s", "y"] : ["x", "z", "y"];
  const placements = [
    { id: "d1", conceptId: "d1", order: 0 },
    { id: "d2", conceptId: "d2", order: 1 },
    { id: "c", conceptId: "c", parentPlacementId: "d1", order: 0 },
    { id: "single", conceptId: "single", parentPlacementId: "d1", order: 1 },
    { id: "c-in-d2", conceptId: "c", parentPlacementId: "d2", order: 0 },
    { id: "p", conceptId: "p", parentPlacementId: "d2", order: 1 },
    ...["a", "b", "s"].map((id, order) => ({ id, conceptId: id, parentPlacementId: "c", order })),
    ...secondLayer.map((id, order) => ({ id: id === "s" ? "s-in-c-in-d2" : id, conceptId: id, parentPlacementId: "c-in-d2", order })),
    ...["q", "r"].map((id, order) => ({ id, conceptId: id, parentPlacementId: "single", order })),
    ...(leaf ? [{ id: "c-in-p", conceptId: "c", parentPlacementId: "p", order: 0 }, { id: "single-in-p", conceptId: "single", parentPlacementId: "p", order: 1 }] : []),
  ];
  const strip = (placementId: string) => placements.filter((placement) => placement.parentPlacementId === placementId).map((placement) => titles[placement.conceptId]);
  const section = (heading: string, placementId: string): MapContentBlock[] => [
    { kind: "heading", text: heading },
    { kind: "paragraph", text: `${heading} explained.` },
    { kind: "terms", terms: strip(placementId) },
  ];
  return {
    concepts: [...new Set(placements.map((placement) => placement.conceptId))].map(concept),
    placements,
    relationships: [],
    content: [
      { id: "d1-content", conceptId: "d1", definition: "Domain one.", body: [...section("Concept in domain one", "c"), ...section("Single in domain one", "single"), { kind: "terms", terms: strip("d1") }] },
      { id: "d2-content", conceptId: "d2", definition: "Domain two.", body: [...section("Concept in domain two", "c-in-d2"), { kind: "terms", terms: ["Concept", "Parent Topic"] }] },
      ...(authoredChild ? [{ id: `${authoredChild}-content`, conceptId: authoredChild, definition: "Authored child." }] : []),
    ],
    mechanisms: [],
    knowledgePaths: [],
  };
}
const facetInspector = (options: Parameters<typeof facetModel>[0] = {}) => {
  const model = facetModel(options);
  return createMapAuthoringInspector(model, { authoredContent: model.content.map((content) => content.conceptId) });
};

test("one child-carrying placement keeps the single-carrier contract", () => {
  const context = facetInspector().inspectConcept("single");
  assert.deepEqual(context.childLayers, {
    carriers: [{ placementId: "single", trail: "01 Domain One / Single", domainId: "d1", isPreferred: true, childCount: 2, uniqueChildConceptIds: ["q", "r"] }],
    sharedChildConceptIds: [],
  });
  assert.ok(context.attention.includes("Only single carries the concept's children; at its other placements it is a leaf, where the same exposition must read as a complete explanation."));
  assert.ok(!context.attention.some((note) => note.startsWith("Children are carried at") || note.startsWith("Facet ") || note.startsWith("Authoring is owned")));
  assert.doesNotMatch(formatMapConceptAuthoringContext(context), /other child-carrying placements/);
});

test("several carriers with overlapping layers are reported as facets", () => {
  const context = facetInspector().inspectConcept("c");
  assert.deepEqual(context.childLayers, {
    carriers: [
      { placementId: "c", trail: "01 Domain One / Concept", domainId: "d1", isPreferred: false, childCount: 3, uniqueChildConceptIds: ["a", "b"] },
      { placementId: "c-in-d2", trail: "02 Domain Two / Concept", domainId: "d2", isPreferred: true, childCount: 3, uniqueChildConceptIds: ["x", "y"] },
    ],
    sharedChildConceptIds: ["s"],
  });
  const notes = context.attention;
  assert.ok(notes.some((note) => note.startsWith("Children are carried at 2 placements, each layer a facet of the concept.")));
  assert.ok(notes.includes("Facet c: 01 Domain One / Concept; 3 children; only in this layer: a, b."));
  assert.ok(notes.includes("Facet c-in-d2 (preferred): 02 Domain Two / Concept; 3 children; only in this layer: x, y."));
  assert.ok(notes.includes("Child concepts shared across facets: s."));
  // Nothing claims a single carrier when there are several.
  assert.ok(!notes.some((note) => note.startsWith("Only ")));
});

test("several carriers with disjoint layers share no child concepts", () => {
  const context = facetInspector({ shared: false }).inspectConcept("c");
  assert.deepEqual(context.childLayers.sharedChildConceptIds, []);
  assert.deepEqual(context.childLayers.carriers.map((carrier) => carrier.uniqueChildConceptIds), [["a", "b", "s"], ["x", "z", "y"]]);
  assert.ok(context.attention.includes("Child concepts shared across facets: none."));
});

test("several carriers plus leaf placements name the leaves without a single-carrier claim", () => {
  const withLeaf = facetInspector().inspectConcept("c");
  assert.ok(withLeaf.attention.includes("At c-in-p the concept is a leaf, where the same exposition must read as a complete explanation."));
  assert.ok(!withLeaf.attention.some((note) => note.startsWith("Only ")));
  const withoutLeaf = facetInspector({ leaf: false }).inspectConcept("c");
  assert.ok(!withoutLeaf.attention.some((note) => note.includes("the concept is a leaf")));
  // A leaf primary context points at every layer, not one.
  const fromLeaf = facetInspector().inspectConcept("c", { contextPlacementId: "c-in-p" });
  assert.ok(fromLeaf.attention.includes("The primary context is a leaf; the concept's child layers are carried at c, c-in-d2."));
});

test("preferred and secondary carrier contexts see the same facets and ownership, with every carrier's parent section", () => {
  const inspector = facetInspector();
  const preferred = inspector.inspectConcept("c");
  const secondary = inspector.inspectConcept("c", { contextPlacementId: "c" });
  assert.equal(preferred.primaryPlacementId, "c-in-d2");
  assert.equal(secondary.primaryPlacementId, "c");
  // Facets are ordered by domain, independent of which carrier is primary.
  assert.deepEqual(preferred.childLayers, secondary.childLayers);
  const ownership = "Authoring is owned by the domain of the preferred placement, Domain Two (c-in-d2); that does not make its layer the canonical decomposition.";
  assert.ok(preferred.attention.includes(ownership) && secondary.attention.includes(ownership));
  // Each view prints its own parent section and the other carrier's.
  const text = (context: ReturnType<typeof inspector.inspectConcept>) => formatMapConceptAuthoringContext(context);
  assert.match(text(preferred), /Parent exposition around the primary context\n {2}Domain Two, section 1 "Concept in domain two":[\s\S]*Parent exposition around the other child-carrying placements\n {2}\[c\] 01 Domain One \/ Concept\n {2}Domain One, section 1 "Concept in domain one":/);
  assert.match(text(secondary), /Parent exposition around the primary context\n {2}Domain One, section 1 "Concept in domain one":[\s\S]*Parent exposition around the other child-carrying placements\n {2}\[c-in-d2\] 02 Domain Two \/ Concept\n {2}Domain Two, section 1 "Concept in domain two":/);
});

test("child content status covers every carrier's layer", () => {
  const context = facetInspector({ authoredChild: "x" }).inspectConcept("c", { contextPlacementId: "c" });
  assert.ok(context.attention.includes("Children with their own exposition: x. Relate to them; do not restate them."));
});

test("domain status shows child layers carried in other domains", () => {
  const status = facetInspector().inspectDomain("d1");
  assert.deepEqual(status.l1.map((entry) => [entry.placementId, entry.otherChildLayers]), [["c", ["c-in-d2"]], ["single", []]]);
  assert.match(formatMapDomainAuthoringStatus(status), /c {6} Concept {2}\(children 0\/3 with content; also L2; 3 placements; preferred at c-in-d2; children also at c-in-d2\)/);
});

test("facet reporting is deterministic", () => {
  for (const conceptId of ["c", "single"]) {
    const [first, second] = [facetInspector().inspectConcept(conceptId), facetInspector().inspectConcept(conceptId)];
    assert.deepEqual(first, second);
    assert.equal(formatMapConceptAuthoringContext(first), formatMapConceptAuthoringContext(second));
  }
});

test("the real ontology's multi-carrier concepts are recognized, and single carriers are unchanged", () => {
  for (const conceptId of ["verifiable-computation", "provenance", "resource-allocation"]) {
    const context = inspector.inspectConcept(conceptId);
    assert.ok(context.childLayers.carriers.length > 1, conceptId);
    assert.ok(context.attention.some((note) => note.startsWith(`Children are carried at ${context.childLayers.carriers.length} placements`)), conceptId);
    assert.ok(!context.attention.some((note) => note.startsWith("Only ")), conceptId);
  }
  for (const conceptId of ["distributed-systems", "protocol-properties", "state-machines"]) {
    assert.equal(inspector.inspectConcept(conceptId).childLayers.carriers.length, 1, conceptId);
  }
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
