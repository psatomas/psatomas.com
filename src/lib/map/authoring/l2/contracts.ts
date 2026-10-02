/**
 * The L2 concept-model, representation-design and audit contracts
 * (docs/map-authoring/l2-analysis.md, sections 14 to 16). Each owned member of
 * a group carries its work in the group's file: the model it was understood
 * by, the representation decided from that model, and the audits that judged
 * the authored record. Validation is deterministic and never judges editorial
 * merit; it checks that each step was done, agrees with the plan and the
 * record, and is bound to the record it judged. Development tooling only.
 */
import type { MapConceptContent, MapKnowledgeModel } from "../../types.ts";
import { catalogEntry, STRUCTURED_KINDS, type BlockKind, type Structure } from "../representation/catalog.ts";
import { contentFingerprint } from "../representation/design.ts";
import type { L2GroupFile } from "./territory.ts";

export const L2_KINDS = ["mechanism", "property", "actor", "attack", "parameter", "artifact", "technology", "institutional"] as const;
export type L2Kind = (typeof L2_KINDS)[number];

/** The fields each kind of concept owes its explanation (section 14); two of them, at least, must be worked out. */
export const KIND_FIELDS: Record<L2Kind, readonly string[]> = {
  mechanism: ["sequence", "actors", "inputs", "outputs", "assumptions", "failures"],
  property: ["statement", "establishedBy", "violatedBy", "confusions"],
  actor: ["role", "powers", "incentives", "trustPlaced", "misbehaviour"],
  attack: ["preconditions", "mechanism", "impact", "defences", "detection"],
  parameter: ["measures", "setBy", "tradeoff", "extremes"],
  artifact: ["contents", "producedBy", "checkedBy", "proves", "lifetime"],
  technology: ["designChoices", "consequences", "nearestAlternative", "datedFacts"],
  institutional: ["distinctions", "consequences", "conditions", "status"],
};
/** Fields any kind may use when it has the structure: states and transitions, invariants, trade-offs, internal variants, a mathematical relation. */
export const CROSS_KIND_FIELDS = ["states", "transitions", "invariants", "tradeoffs", "variants", "relation"] as const;
const MIN_KIND_FIELDS = 2;

export type L2ConceptModel = {
  /** The concept's core meaning in one sentence. */
  meaning: string;
  kind: L2Kind;
  /** For each parent concept: what this concept adds beyond what the parent already says. */
  parents: Record<string, string>;
  /** The plan's claims and excludes, carried into the model so the reasoning works inside them. */
  claims: string[];
  excludes: string[];
  /** For each placement: why one exposition holds there. */
  placements: Record<string, string>;
  /** The kind's fields and any cross-kind fields the concept has. */
  fields: Record<string, string | string[]>;
};

export type L2Design = {
  decision: "prose" | "structure" | "block";
  /** The semantic relationship that drives the decision. */
  relationship: string;
  /** Structure: each structured choice, what it shows and why prose alone would obscure it. */
  structures?: { structure: Structure; purpose: string; whyNotProse: string }[];
  /** Prose: why no structure carries meaning prose would obscure. */
  whyProse?: string;
  /** A relationship no primitive expresses: written in prose when prose is accurate, otherwise the concept is blocked. */
  gap?: { structure: Structure; reason: string };
  /** Why the representation belongs at this concept rather than its parent or another placed concept. */
  level: string;
  /** Why it draws no sibling's or reserved concept's relationship. */
  territory: string;
  /** Why it holds at every placement. */
  placements: string;
  /** What the prose explains that the structure does not, and what the structure shows that the prose must not restate. */
  division?: string;
};

/** Each signal the deterministic and heuristic checks raised, and how the audit resolved it. */
export type L2Resolution = { id: string; resolution: string };
export type L2Audit = { at: string; note: string; resolutions: L2Resolution[]; recordFingerprint: string };
export type L2ConceptWork = { model: L2ConceptModel; design: L2Design; audit?: L2Audit };
/** The group audit, over every owned member as authored. */
export type L2GroupAudit = { at: string; note: string; resolutions: L2Resolution[]; records: Record<string, string> };

const blank = (value: unknown) => typeof value !== "string" || !value.trim();
const empty = (value: unknown) => (Array.isArray(value) ? value.length === 0 || value.some(blank) : blank(value));
const sameSet = (a: readonly string[], b: readonly string[]) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

/** Structured block kinds a record writes down. */
export const recordStructures = (record: MapConceptContent | undefined): BlockKind[] =>
  [...new Set((record?.body ?? []).map((block) => block.kind).filter((kind) => STRUCTURED_KINDS.has(kind)))].sort();

/** Parent concepts of a concept's L2 placements, and its placements. */
export function placementFacts(model: MapKnowledgeModel, conceptId: string): { parents: string[]; placements: string[] } {
  const byId = new Map(model.placements.map((placement) => [placement.id, placement]));
  const placements = model.placements.filter((placement) => placement.conceptId === conceptId);
  return {
    parents: [...new Set(placements.flatMap((placement) => (placement.parentPlacementId ? [byId.get(placement.parentPlacementId)!.conceptId] : [])))].sort(),
    placements: placements.map((placement) => placement.id),
  };
}

export function modelProblems(work: L2ConceptWork, conceptId: string, plan: L2GroupFile, model: MapKnowledgeModel): string[] {
  const problems: string[] = [];
  const m = work.model;
  if (!m) return ["the concept model is missing"];
  if (blank(m.meaning)) problems.push("the model needs its core meaning");
  if (!(L2_KINDS as readonly string[]).includes(m.kind)) return [...problems, `kind must be one of ${L2_KINDS.join(", ")}`];
  const allowed = new Set<string>([...KIND_FIELDS[m.kind], ...CROSS_KIND_FIELDS]);
  const fields = m.fields ?? {};
  for (const field of Object.keys(fields)) if (!allowed.has(field)) problems.push(`field "${field}" belongs to no ${m.kind} model; use ${[...allowed].join(", ")}`);
  const worked = KIND_FIELDS[m.kind].filter((field) => !empty(fields[field]));
  if (worked.length < MIN_KIND_FIELDS) problems.push(`a ${m.kind} model works out at least ${MIN_KIND_FIELDS} of ${KIND_FIELDS[m.kind].join(", ")}`);
  for (const [field, value] of Object.entries(fields)) if (empty(value)) problems.push(`field "${field}" is empty: leave out what the concept does not have`);
  const member = plan.members.find((entry) => entry.conceptId === conceptId && entry.standing === "owned");
  if (!member) return [...problems, `${conceptId} is not owned by ${plan.group}`];
  if (!sameSet(m.claims ?? [], member.claims ?? [])) problems.push("the model's claims must be the plan's");
  if (!sameSet(m.excludes ?? [], member.excludes ?? [])) problems.push("the model's excludes must be the plan's");
  const facts = placementFacts(model, conceptId);
  if (!sameSet(Object.keys(m.parents ?? {}), facts.parents)) problems.push(`parents must be exactly ${facts.parents.join(", ")}: say what this adds beyond each`);
  for (const [parent, adds] of Object.entries(m.parents ?? {})) if (blank(adds)) problems.push(`parent ${parent}: say what this concept adds beyond it`);
  if (!sameSet(Object.keys(m.placements ?? {}), facts.placements)) problems.push(`placements must be exactly ${facts.placements.join(", ")}`);
  for (const [placement, note] of Object.entries(m.placements ?? {})) if (blank(note)) problems.push(`placement ${placement}: say why the exposition holds there`);
  return problems;
}

export function designProblems(design: L2Design | undefined): string[] {
  if (!design) return ["the representation design is missing"];
  const problems: string[] = [];
  if (!["prose", "structure", "block"].includes(design.decision)) return ["decision must be prose, structure or block"];
  for (const field of ["relationship", "level", "territory", "placements"] as const) if (blank(design[field])) problems.push(`the design needs "${field}"`);
  if (design.decision === "structure") {
    if (!design.structures?.length) problems.push("a structure decision names its structures");
    for (const choice of design.structures ?? []) {
      const entry = catalogEntry(choice.structure);
      if (!entry || !entry.block || !STRUCTURED_KINDS.has(entry.block)) problems.push(`"${choice.structure}" is no structured block: choose from the catalog's native and approximate fits`);
      else if (entry.fit === "gap") problems.push(`"${choice.structure}" has no block: record a gap instead`);
      if (blank(choice.purpose) || blank(choice.whyNotProse)) problems.push(`"${choice.structure}" needs its purpose and why prose alone would obscure it`);
    }
    if (blank(design.division)) problems.push("a structure decision says what the prose explains and what the structure shows");
  } else if (design.structures?.length) problems.push(`a ${design.decision} decision draws no structure`);
  if (design.decision === "prose" && blank(design.whyProse)) problems.push("a prose decision says why no structure would carry meaning prose obscures");
  if (design.decision === "block") {
    if (!design.gap || catalogEntry(design.gap.structure)?.fit !== "gap" || blank(design.gap.reason)) problems.push("a block decision records the missing structure (a catalog gap) and why prose cannot carry it");
  } else if (design.gap && (catalogEntry(design.gap.structure)?.fit !== "gap" || blank(design.gap.reason))) problems.push("a recorded gap names a catalog gap and its reason");
  return problems;
}

/** The authored record against its design: exactly the designed structures, or none for prose. */
export function recordDesignProblems(design: L2Design, record: MapConceptContent | undefined): string[] {
  if (!record) return ["no record has been authored"];
  if (design.decision === "block") return ["the design blocks this concept: it must not be authored"];
  const expected = [...new Set((design.structures ?? []).map((choice) => catalogEntry(choice.structure)!.block!))].sort();
  const actual = recordStructures(record);
  return JSON.stringify(actual) === JSON.stringify(expected) ? [] : [`the record writes ${actual.join(", ") || "prose only"}; the design decided ${expected.join(", ") || "prose only"}`];
}

/** Signals an audit leaves unresolved, or resolves without saying how. */
export function resolutionProblems(signalIds: readonly string[], resolutions: readonly L2Resolution[]): string[] {
  const resolved = new Map(resolutions.map((entry) => [entry.id, entry.resolution]));
  return signalIds.filter((id) => blank(resolved.get(id))).map((id) => `signal ${id} is unresolved: say how the audit judged it`);
}

export type L2WorkStage = "designed" | "authored" | "audited";

/**
 * Everything wrong with one owned concept's work at a stage: the model and
 * design always; the record against the design once authored; and, once
 * audited, the audit bound to exactly this record with every signal resolved.
 */
export function workProblems(plan: L2GroupFile, conceptId: string, model: MapKnowledgeModel, stage: L2WorkStage, signalIds: readonly string[] = []): string[] {
  const work = plan.concepts[conceptId] as L2ConceptWork | undefined;
  if (!work) return [`${conceptId}: no concept work in ${plan.group}`];
  const record = model.content.find((entry) => entry.conceptId === conceptId);
  const problems = [...modelProblems(work, conceptId, plan, model), ...designProblems(work.design)];
  if (stage !== "designed" && work.design) problems.push(...recordDesignProblems(work.design, record));
  if (stage === "audited") {
    if (!work.audit) problems.push("the concept audit is missing");
    else {
      if (blank(work.audit.note)) problems.push("the concept audit needs its note");
      if (work.audit.recordFingerprint !== contentFingerprint(record)) problems.push("the record changed after its audit: audit it again");
      problems.push(...resolutionProblems(signalIds, work.audit.resolutions ?? []));
    }
  }
  return problems.map((problem) => `${conceptId}: ${problem}`);
}

/** The group audit, bound to every owned member's record as authored, with its group signals resolved. */
export function groupAuditProblems(plan: L2GroupFile & { groupAudit?: L2GroupAudit }, model: MapKnowledgeModel, signalIds: readonly string[] = []): string[] {
  const audit = plan.groupAudit;
  if (!audit) return ["the group audit is missing"];
  const problems: string[] = [];
  if (blank(audit.note)) problems.push("the group audit needs its note");
  const owned = plan.members.filter((member) => member.standing === "owned").map((member) => member.conceptId);
  for (const conceptId of owned) {
    if (audit.records?.[conceptId] !== contentFingerprint(model.content.find((entry) => entry.conceptId === conceptId))) problems.push(`${conceptId} changed after the group audit, or was not in it`);
  }
  return [...problems, ...resolutionProblems(signalIds, audit.resolutions ?? [])];
}
