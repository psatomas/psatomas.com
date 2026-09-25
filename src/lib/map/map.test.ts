import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { mapKnowledge } from "./data.ts";
import { createMapResolver } from "./resolver.ts";
import { MapKnowledgeValidationError, validateMapKnowledge } from "./validation.ts";
import type { MapKnowledgeModel } from "./types.ts";
import { staticSocial } from "../social/content.ts";
import { buildSocialMetadata } from "../social/metadata.ts";

const resolver = createMapResolver(mapKnowledge);

function errorsFor(mutator: (model: MapKnowledgeModel) => MapKnowledgeModel): string[] {
  return validateMapKnowledge(mutator(mapKnowledge));
}

const L0_DOMAINS: Array<[string, string]> = [
  ["foundations", "Foundations"],
  ["computation-execution", "Computation & Execution"],
  ["state-data", "State & Data"],
  ["consensus-ordering", "Consensus & Ordering"],
  ["networks-infrastructure", "Networks & Infrastructure"],
  ["cryptography-proofs", "Cryptography & Proofs"],
  ["storage-availability", "Storage & Availability"],
  ["identity-accounts-authority", "Identity, Accounts & Authority"],
  ["oracles-external-reality", "Oracles & External Reality"],
  ["economics-mechanism-design", "Economics & Mechanism Design"],
  ["markets-financial-protocols", "Markets & Financial Protocols"],
  ["mev-execution-markets", "MEV & Execution Markets"],
  ["intents-coordination", "Intents & Coordination"],
  ["governance-institutions", "Governance & Institutions"],
  ["scaling-modular-systems", "Scaling & Modular Systems"],
  ["interoperability-abstraction", "Interoperability & Abstraction"],
  ["security-correctness-resilience", "Security, Correctness & Resilience"],
  ["protocol-architecture", "Protocol Architecture"],
  ["protocol-design-lifecycle", "Protocol Design & Lifecycle"],
  ["ai-intelligent-systems", "AI & Intelligent Systems"],
  ["machine-economy", "Machine Economy"],
  ["autonomous-coordination", "Autonomous Coordination"],
  ["autonomous-execution", "Autonomous Execution"],
  ["autonomous-organizations", "Autonomous Organizations"],
  ["autonomous-protocols", "Autonomous Protocols"],
  ["autonomous-economy", "Autonomous Economy"],
  ["frontier-systems", "Frontier Systems"],
];

test("the taxonomy root is exactly the 27 L0 domains in agreed order", () => {
  const roots = resolver.getRootPlacements();
  assert.deepEqual(roots.map((placement) => placement.id), L0_DOMAINS.map(([id]) => id));
  assert.deepEqual(roots.map((placement) => placement.order), L0_DOMAINS.map((_, index) => index));
  for (const [id, title] of L0_DOMAINS) {
    const placement = resolver.getPlacement(id);
    assert.equal(placement?.conceptId, id);
    assert.equal(resolver.getConcept(id)?.title, title);
    assert.deepEqual(resolver.getPlacementsForConcept(id).map((entry) => entry.id), [id]);
  }
});

test("the root taxonomy agrees with the L0 domains in the MAP specification", () => {
  const spec = readFileSync(new URL("../../../docs/map-spec.md", import.meta.url), "utf8");
  const scope = spec.slice(spec.indexOf("## 5. Long-term knowledge scope"), spec.indexOf("## 6."));
  const specDomains = [...scope.matchAll(/^\d+\. (.+)$/gm)].map((match) => match[1]);

  assert.deepEqual(specDomains, L0_DOMAINS.map(([, title]) => title));
});

test("/map canonical metadata is the environment URL, never a context query", () => {
  const metadata = buildSocialMetadata(staticSocial.map);
  assert.equal(metadata.alternates?.canonical, "https://psatomas.com/map");
  assert.equal(metadata.openGraph?.url, "https://psatomas.com/map");
});

test("canonical concept identities stay unique after adding the L0 layer", () => {
  const ids = mapKnowledge.concepts.map((concept) => concept.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.length, 27 + 11 + 6);
});

test("the Phase 1 proof fixture is re-homed beneath its L0 domains with stable placement IDs", () => {
  const parents = Object.fromEntries(
    mapKnowledge.placements.filter((placement) => placement.parentPlacementId).map((placement) => [placement.id, placement.parentPlacementId]),
  );
  assert.deepEqual(parents, {
    protocols: "foundations",
    "distributed-systems": "foundations",
    "state-machines": "foundations",
    "trust-models": "foundations",
    coordination: "foundations",
    "adversarial-environments": "foundations",
    "protocol-properties": "foundations",
    consensus: "consensus-ordering",
    "finality-in-consensus": "consensus",
    scaling: "scaling-modular-systems",
    rollups: "scaling",
    "finality-in-rollups": "rollups",
    identity: "identity-accounts-authority",
    "agent-identity": "identity",
    authority: "identity-accounts-authority",
    "ai-agent": "ai-intelligent-systems",
  });
  // Settlement and Economic Agency stay deliberately unplaced.
  assert.deepEqual(resolver.getPlacementsForConcept("settlement"), []);
  assert.deepEqual(resolver.getPlacementsForConcept("economic-agency"), []);
});

test("re-homing changes no relationship, content, mechanism, or path record", () => {
  assert.deepEqual(mapKnowledge.relationships.map((relationship) => relationship.id), [
    "finality-finalizes-settlement",
    "rollups-depend-on-finality",
    "agent-identity-authenticates-ai-agent",
    "authority-constrains-ai-agent",
    "agent-identity-enables-economic-agency",
  ]);
  assert.deepEqual(mapKnowledge.content.map((content) => content.conceptId), ["foundations", "finality", "agent-identity"]);
  assert.deepEqual(mapKnowledge.mechanisms.map((mechanism) => mechanism.id), ["consensus-to-finality"]);
  assert.deepEqual(mapKnowledge.knowledgePaths.map((path) => path.id), ["distributed-systems-to-rollups"]);
  // L0 domains may own canonical content, but taxonomy creates no semantic
  // edges, mechanism steps, or path steps for them.
  const l0 = new Set(L0_DOMAINS.map(([id]) => id));
  const referenced = [
    ...mapKnowledge.relationships.flatMap((relationship) => [relationship.sourceConceptId, relationship.targetConceptId]),
    ...mapKnowledge.mechanisms.flatMap((mechanism) => [mechanism.conceptId, ...mechanism.steps.map((step) => step.conceptId)]),
    ...mapKnowledge.knowledgePaths.flatMap((path) => path.conceptIds),
  ];
  assert.deepEqual(referenced.filter((conceptId) => l0.has(conceptId)), []);
});

const FOUNDATIONS_LAYER = [
  "protocols",
  "distributed-systems",
  "state-machines",
  "trust-models",
  "coordination",
  "adversarial-environments",
  "protocol-properties",
];

test("Foundations owns exactly one canonical content record, which its placement does not duplicate", () => {
  const owned = mapKnowledge.content.filter((content) => content.conceptId === "foundations");
  assert.equal(owned.length, 1);
  assert.equal(resolver.getContentForConcept("foundations"), owned[0]);
  assert.ok(owned[0].definition.startsWith("Protocols begin before implementation."));
  assert.ok((owned[0].body?.length ?? 0) > 0);

  // Placements carry identity and context only; no placement repeats exposition text.
  const texts = mapKnowledge.content.flatMap((content) => [
    content.definition,
    ...(content.body ?? []).flatMap((block) => (block.kind === "paragraph" ? [block.text] : [])),
  ]);
  for (const placement of mapKnowledge.placements) {
    assert.deepEqual(
      Object.keys(placement).filter((key) => !["id", "conceptId", "parentPlacementId", "order", "contextualLabel", "contextualNote"].includes(key)),
      [],
      placement.id,
    );
    assert.ok(!texts.some((text) => placement.contextualNote && text.includes(placement.contextualNote)), placement.id);
  }
});

test("Foundations' next conceptual layer is its seven child placements, each its own concept", () => {
  assert.deepEqual(resolver.getChildren("foundations").map((placement) => placement.id), FOUNDATIONS_LAYER);
  for (const id of FOUNDATIONS_LAYER) {
    assert.equal(resolver.getPlacement(id)?.conceptId, id);
    assert.ok(resolver.getConcept(id));
    // Explanation before decomposition: the children are identities for now.
    assert.equal(resolver.getContentForConcept(id), undefined);
    assert.deepEqual(resolver.getChildren(id), []);
  }
});

test("Foundations exposition is canonical data: models, a distinction, and tensions", () => {
  const body = resolver.getContentForConcept("foundations")?.body ?? [];
  assert.deepEqual(body.map((block) => block.kind), [
    "paragraph", "flow", "paragraph", "flow", "distinction", "paragraph", "tensions", "paragraph", "paragraph",
  ]);
  const flows = body.filter((block) => block.kind === "flow");
  assert.deepEqual(flows[0].stages, [["Participants"], ["Rules"], ["Actions", "Messages"], ["State transitions"], ["System state"]]);
  assert.deepEqual(body.find((block) => block.kind === "distinction"), { kind: "distinction", left: "Local correctness", right: "System correctness" });
  // No markup or styling leaks into the text values.
  const strings: string[] = [];
  JSON.stringify(body, (_key, value) => (typeof value === "string" && strings.push(value), value));
  assert.ok(strings.length > 0 && strings.every((text) => !/[<>{}]|className|style=/.test(text)));
});

test("one canonical Finality concept resolves through two independent placements", () => {
  const consensusFinality = resolver.getPlacement("finality-in-consensus");
  const rollupFinality = resolver.getPlacement("finality-in-rollups");

  assert.ok(consensusFinality);
  assert.ok(rollupFinality);
  assert.notEqual(consensusFinality.id, rollupFinality.id);
  assert.equal(consensusFinality.conceptId, "finality");
  assert.equal(rollupFinality.conceptId, "finality");
  assert.equal(resolver.getConcept(consensusFinality.conceptId), resolver.getConcept(rollupFinality.conceptId));
  assert.deepEqual(
    resolver.getPlacementsForConcept("finality").map((placement) => placement.id),
    ["finality-in-consensus", "finality-in-rollups"],
  );
  assert.deepEqual(
    resolver.getAncestors("finality-in-rollups").map((placement) => placement.id),
    ["scaling-modular-systems", "scaling", "rollups"],
  );
});

test("taxonomy nesting does not create semantic relationships", () => {
  assert.deepEqual(resolver.getChildren("consensus").map((placement) => placement.conceptId), ["finality"]);
  assert.deepEqual(resolver.getChildren("consensus-ordering").map((placement) => placement.conceptId), ["consensus"]);
  assert.deepEqual(resolver.getRelationshipsFrom("consensus-ordering"), []);
  assert.deepEqual(resolver.getRelationshipsTo("consensus"), []);
  assert.deepEqual(resolver.getRelationshipsFrom("consensus"), []);
  assert.deepEqual(resolver.getRelationshipsTo("finality").map((relationship) => relationship.id), [
    "rollups-depend-on-finality",
  ]);
});

test("knowledge paths use independent curated order", () => {
  const path = resolver.getKnowledgePath("distributed-systems-to-rollups");
  assert.ok(path);
  assert.deepEqual(path.conceptIds, ["distributed-systems", "consensus", "finality", "scaling", "rollups"]);
  assert.notEqual(path.conceptIds.join("/"), "distributed-systems/consensus/finality");
});

test("canonical content is owned once despite multiple placements", () => {
  assert.equal(resolver.getContentForConcept("finality")?.definition, "The point at which a protocol treats a result as no longer practically reversible.");
  assert.equal(mapKnowledge.content.filter((content) => content.conceptId === "finality").length, 1);
  assert.equal(resolver.getPlacement("finality-in-consensus")?.contextualNote?.includes("consensus"), true);
  assert.equal(resolver.getPlacement("finality-in-rollups")?.contextualNote?.includes("rollup"), true);
});

test("agentic concepts use the same concepts, placements, relationships, and resolver", () => {
  assert.equal(resolver.getConcept("ai-agent")?.title, "AI Agent");
  assert.equal(resolver.getPlacement("agent-identity")?.conceptId, "agent-identity");
  assert.deepEqual(resolver.getRelationshipsTo("ai-agent").map((relationship) => relationship.typeId), [
    "authenticates",
    "constrains",
  ]);
  assert.deepEqual(resolver.getRelationshipsFrom("agent-identity").map((relationship) => relationship.targetConceptId), [
    "ai-agent",
    "economic-agency",
  ]);
});

test("sparse and orphan concepts remain valid", () => {
  assert.equal(resolver.getConcept("economic-agency")?.title, "Economic Agency");
  assert.deepEqual(resolver.getPlacementsForConcept("economic-agency"), []);
  assert.equal(resolver.getContentForConcept("economic-agency"), undefined);
  assert.deepEqual(resolver.getRelationshipsTo("economic-agency").map((relationship) => relationship.typeId), ["enables"]);
});

test("validation rejects malformed references, cycles, and semantic edges", () => {
  const cases: Array<[string, string[], string]> = [
    [
      "duplicate concept",
      errorsFor((model) => ({ ...model, concepts: [...model.concepts, model.concepts[0]] })),
      'Duplicate concept identifier "foundations"',
    ],
    [
      "dangling placement concept",
      errorsFor((model) => ({
        ...model,
        placements: [...model.placements, { id: "dangling-placement", conceptId: "missing", order: 5 }],
      })),
      'Placement "dangling-placement" references missing concept "missing"',
    ],
    [
      "placement cycle",
      errorsFor((model) => ({
        ...model,
        placements: model.placements.map((placement) =>
          placement.id === "foundations" ? { ...placement, parentPlacementId: "distributed-systems" } : placement,
        ),
      })),
      'Placement hierarchy contains cycle at "foundations"',
    ],
    [
      "dangling relationship target",
      errorsFor((model) => ({
        ...model,
        relationships: [...model.relationships, {
          id: "dangling-target", sourceConceptId: "finality", targetConceptId: "missing", typeId: "finalizes",
        }],
      })),
      'Relationship "dangling-target" references missing target concept "missing"',
    ],
    [
      "unknown relationship type",
      errorsFor((model) => ({
        ...model,
        relationships: [...model.relationships, {
          id: "unknown-type", sourceConceptId: "finality", targetConceptId: "settlement", typeId: "unknown" as never,
        }],
      })),
      'Relationship "unknown-type" uses unregistered type "unknown"',
    ],
    [
      "duplicate semantic edge",
      errorsFor((model) => ({
        ...model,
        relationships: [...model.relationships, {
          ...model.relationships[0], id: "duplicate-finality-edge",
        }],
      })),
      'Duplicate semantic relationship edge "finality" -> "settlement" (finalizes)',
    ],
    [
      "invalid self edge",
      errorsFor((model) => ({
        ...model,
        relationships: [...model.relationships, {
          id: "self-edge", sourceConceptId: "finality", targetConceptId: "finality", typeId: "finalizes",
        }],
      })),
      'Relationship "self-edge" prohibits self-edge for type "finalizes"',
    ],
    [
      "dangling content",
      errorsFor((model) => ({
        ...model,
        content: [...model.content, { id: "dangling-content", conceptId: "missing", definition: "Missing." }],
      })),
      'Content "dangling-content" references missing concept "missing"',
    ],
    [
      "dangling mechanism step",
      errorsFor((model) => ({
        ...model,
        mechanisms: [...model.mechanisms, {
          id: "dangling-mechanism", conceptId: "finality", title: "Broken", steps: [{ conceptId: "finality" }, { conceptId: "missing" }],
        }],
      })),
      'Mechanism "dangling-mechanism" references missing step concept "missing"',
    ],
    [
      "dangling knowledge path",
      errorsFor((model) => ({
        ...model,
        knowledgePaths: [...model.knowledgePaths, {
          id: "dangling-path", slug: "dangling-path", title: "Broken", summary: "Broken.", conceptIds: ["finality", "missing"],
        }],
      })),
      'Knowledge path "dangling-path" references missing concept "missing"',
    ],
  ];

  for (const [name, errors, expected] of cases) {
    assert.ok(errors.includes(expected), `${name}: expected ${expected}; got ${errors.join("; ")}`);
  }
});

test("exposition validation reports every malformed block", () => {
  const errors = errorsFor((model) => ({
    ...model,
    content: [...model.content, {
      id: "malformed-exposition", conceptId: "economic-agency", definition: "Defined.",
      body: [
        { kind: "paragraph", text: "  " },
        { kind: "flow", label: "One stage", stages: [["Only"]] },
        { kind: "distinction", left: "Local", right: "" },
        { kind: "tensions", label: "Pairs", pairs: [["Safety", ""]] },
      ],
    }],
  }));
  assert.deepEqual(errors.filter((error) => error.startsWith('Content "malformed-exposition"')), [
    'Content "malformed-exposition" block 0 (paragraph) is empty',
    'Content "malformed-exposition" block 1 (flow) must contain at least two stages',
    'Content "malformed-exposition" block 2 (distinction) must name both sides',
    'Content "malformed-exposition" block 3 (tensions) has an incomplete pair',
  ]);
});

test("resolver rejects invalid models rather than repairing them", () => {
  const invalid = { ...mapKnowledge, concepts: [...mapKnowledge.concepts, mapKnowledge.concepts[0]] };
  assert.throws(() => createMapResolver(invalid), MapKnowledgeValidationError);
});
