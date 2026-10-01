/**
 * Concept analysis and representation design for existing canonical
 * exposition (docs/map-authoring/representation-design.md). Development
 * tooling only, never rendered: a design is the reasoning that precedes
 * writing, not exposition.
 *
 * The agent analyses a concept into a model, decides which representation
 * communicates that model, and classifies the existing record. This module
 * holds the shapes, checks that a design is internally consistent and bound to
 * the content it judged, and never judges the editorial question itself.
 */
import { createHash } from "node:crypto";
import type { MapConceptContent, MapKnowledgeModel } from "../../types.ts";
import { createMapAuthoringInspector } from "../context.ts";
import { catalogEntry, STRUCTURED_KINDS, type BlockKind, type Structure } from "./catalog.ts";

export const CLASSIFICATIONS = ["keep", "refactor", "enhance", "rewrite"] as const;
export type Classification = (typeof CLASSIFICATIONS)[number];

/**
 * What the concept is, before any decision about form. Every field except the
 * purpose is optional: an analysis records the concept's actual structure and
 * leaves out what it does not have.
 */
export type ConceptModel = {
  purpose: string;
  problem?: string;
  actors?: string[];
  inputs?: string[];
  outputs?: string[];
  relationships?: string[];
  sequence?: string[];
  lifecycle?: string[];
  composition?: string[];
  dependencies?: string[];
  assumptions?: string[];
  invariants?: string[];
  variants?: string[];
  tradeoffs?: string[];
  failures?: string[];
  distinctions?: string[];
  /** How the concept relates to its parent, siblings, authored neighbours and other placements. */
  context?: string;
};

/** One part of the recommended representation: the structure it shows and why it earns its place. */
export type RepresentationChoice = { structure: Structure; purpose: string };

export type RepresentationDesign = {
  conceptId: string;
  classification: Classification;
  model: ConceptModel;
  /** The whole recommended representation, prose included. */
  representation: RepresentationChoice[];
  reasoning: string;
  /** Required for rewrite: the concrete problem with the substance itself. */
  rewriteJustification?: string;
  /** Required when the concept has several placements: why the representation holds at each. */
  canonicalNote?: string;
  /** Required when several placements carry children: how it relates the facets without synthesizing one layer. */
  facetNote?: string;
};

export type StoredDesign = RepresentationDesign & { contentFingerprint: string; recordedAt: string };

/** The record a design judged, fingerprinted: a later content change makes the design stale. */
export const contentFingerprint = (record: MapConceptContent | undefined) => createHash("sha256").update(JSON.stringify(record ?? null)).digest("hex");

/** The current form of a record: its block sequence and which structures it already writes down. */
export type RepresentationProfile = {
  sequence: string;
  kinds: Partial<Record<BlockKind, number>>;
  words: number;
  structured: BlockKind[];
  proseOnly: boolean;
};

const LETTER: Record<BlockKind, string> = { paragraph: "P", heading: "H", flow: "F", distinction: "D", tensions: "T", terms: "S" };

export function profileOf(record: MapConceptContent): RepresentationProfile {
  const body = record.body ?? [];
  const kinds: Partial<Record<BlockKind, number>> = {};
  for (const block of body) kinds[block.kind] = (kinds[block.kind] ?? 0) + 1;
  const text = [record.definition, record.summary, record.explanation, record.whyItMatters, ...body.map((block) => ("text" in block ? block.text : ""))].filter(Boolean).join(" ");
  const structured = [...new Set(body.map((block) => block.kind).filter((kind) => STRUCTURED_KINDS.has(kind)))];
  return { sequence: ["def", ...body.map((block) => LETTER[block.kind])].join("+"), kinds, words: text.split(/\s+/).filter(Boolean).length, structured, proseOnly: structured.length === 0 };
}

/** Placement facts a design must respect, read through the authoring inspector. */
export type ConceptPlacements = { placements: { placementId: string; level: string; domainId: string }[]; carriers: number; ownerDomainId: string };

// One inspector per model: building it validates the whole model.
const inspectors = new WeakMap<MapKnowledgeModel, ReturnType<typeof createMapAuthoringInspector>>();
const inspectorFor = (model: MapKnowledgeModel) => {
  let inspector = inspectors.get(model);
  if (!inspector) inspectors.set(model, (inspector = createMapAuthoringInspector(model, { authoredContent: model.content.map((record) => record.conceptId) })));
  return inspector;
};

export function placementsOf(model: MapKnowledgeModel, conceptId: string): ConceptPlacements {
  const context = inspectorFor(model).inspectConcept(conceptId);
  const carriers = context.childLayers.carriers;
  // Ownership as the domain runbook defines it: the one carrier's domain, the
  // preferred carrier's domain under the facet rule, else the preferred placement's.
  const owner = (carriers.length === 1 ? carriers[0] : carriers.find((carrier) => carrier.isPreferred))?.domainId ?? context.placements.find((placement) => placement.isPreferred)?.domain.placementId ?? context.placements[0]?.domain.placementId;
  return {
    placements: context.placements.map((placement) => ({ placementId: placement.placementId, level: placement.level, domainId: placement.domain.placementId })),
    carriers: carriers.length,
    ownerDomainId: owner ?? "",
  };
}

/** Problems that make a design inconsistent with itself, the catalog or the concept's placements. Editorial merit is not judged. */
export function validateDesign(design: RepresentationDesign, record: MapConceptContent | undefined, facts: ConceptPlacements): string[] {
  const problems: string[] = [];
  const blank = (value: string | undefined) => !value || !value.trim();
  if (!record) problems.push(`${design.conceptId} has no content: the audit judges existing exposition only`);
  if (!(CLASSIFICATIONS as readonly string[]).includes(design.classification)) problems.push(`classification must be one of ${CLASSIFICATIONS.join(", ")}`);
  if (blank(design.model?.purpose)) problems.push("the concept model needs a purpose");
  if (blank(design.reasoning)) problems.push("the decision needs reasoning");
  if (!design.representation?.length) problems.push("the representation names at least one structure (prose is one)");
  for (const choice of design.representation ?? []) {
    if (!catalogEntry(choice.structure)) problems.push(`unknown structure "${choice.structure}"`);
    if (blank(choice.purpose)) problems.push(`structure "${choice.structure}" needs a purpose: what it shows that prose would not`);
  }
  if (design.classification === "rewrite" && blank(design.rewriteJustification)) problems.push("rewrite needs a concrete justification of the substantive problem");
  if (design.classification !== "rewrite" && design.rewriteJustification) problems.push("only a rewrite carries a rewrite justification");
  if (facts.placements.length > 1 && blank(design.canonicalNote)) problems.push(`${facts.placements.length} placements: the design needs a canonical note on why the representation holds at each`);
  if (facts.carriers > 1 && blank(design.facetNote)) problems.push(`${facts.carriers} child-carrying placements: the design needs a facet note`);

  if (record && design.representation?.length) {
    const current = new Set(profileOf(record).structured);
    const recommended = new Set(design.representation.map((choice) => catalogEntry(choice.structure)?.block).filter((kind): kind is BlockKind => kind !== undefined && STRUCTURED_KINDS.has(kind)));
    const gaps = capabilityGaps(design);
    const same = current.size === recommended.size && [...current].every((kind) => recommended.has(kind));
    if (design.classification === "keep" && (!same || gaps.length)) problems.push("keep recommends the current form: its structured blocks must be the record's, with no capability gap");
    if (design.classification === "enhance" && ![...recommended].some((kind) => !current.has(kind)) && !gaps.length) problems.push("enhance adds a structure the record does not have");
    // Refactor may add a structure built from existing substance, or remove one that does not earn its place.
    if (design.classification === "refactor" && same && !gaps.length) problems.push("refactor changes the record's form; an unchanged form is keep");
  }
  return problems;
}

/** Structures the design needs that no block expresses today: new UI or schema capability. */
export const capabilityGaps = (design: RepresentationDesign): Structure[] =>
  [...new Set((design.representation ?? []).filter((choice) => catalogEntry(choice.structure)?.fit === "gap").map((choice) => choice.structure))];

export type DesignStatus = "pending" | "designed" | "stale" | "invalid";

export function designStatus(stored: StoredDesign | undefined, record: MapConceptContent | undefined, facts: ConceptPlacements): { status: DesignStatus; problems: string[] } {
  if (!stored) return { status: "pending", problems: [] };
  if (stored.contentFingerprint !== contentFingerprint(record)) return { status: "stale", problems: ["the content changed after the design was recorded; analyse it again"] };
  const problems = validateDesign(stored, record, facts);
  return problems.length ? { status: "invalid", problems } : { status: "designed", problems: [] };
}

/** The local design store for one domain (.map-authoring/representation/<domain>.json). */
export type DesignStore = { version: 1; level: number; domainId: string; designs: Record<string, StoredDesign> };

export const emptyStore = (domainId: string, level = 1): DesignStore => ({ version: 1, level, domainId, designs: {} });

/** Records a validated design against the content it judged. Refuses an invalid design; replaces an earlier one. */
export function recordDesign(store: DesignStore, design: RepresentationDesign, record: MapConceptContent | undefined, facts: ConceptPlacements, now: string): DesignStore {
  if (facts.ownerDomainId !== store.domainId) throw new Error(`${design.conceptId} is owned by ${facts.ownerDomainId}, not ${store.domainId}`);
  const problems = validateDesign(design, record, facts);
  if (problems.length) throw new Error(`invalid design for ${design.conceptId}:\n  ${problems.join("\n  ")}`);
  return { ...store, designs: { ...store.designs, [design.conceptId]: { ...design, contentFingerprint: contentFingerprint(record), recordedAt: now } } };
}
