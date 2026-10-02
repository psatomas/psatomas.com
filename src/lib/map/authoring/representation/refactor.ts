/**
 * Accepted representation designs as repository-owned governance for L1
 * refactor runs (docs/map-authoring/representation-design.md#refactor-mode).
 * Development tooling only; pure functions over the model and the spec.
 *
 * The spec lists only improvement designs, actionable or blocked by a missing
 * primitive, each tied by fingerprint to the exact record it reviewed. Every
 * other concept is KEEP by construction: a refactor run may change nothing it
 * does not list. A run records, per actionable design, whether the agent
 * executed it, made a smaller change within it, or kept the record, and that
 * resolution is written back into the spec in the same commit as the content.
 * A blocked design can only be resolved as keep, by re-review
 * (reviewBlockedDesign).
 */
import { createHash } from "node:crypto";
import type { MapConceptContent, MapKnowledgeModel } from "../../types.ts";
import { catalogEntry, STRUCTURED_KINDS, type BlockKind, type Structure } from "./catalog.ts";
import { capabilityGaps, contentFingerprint, placementsOf, profileOf, type ConceptModel, type DesignStore } from "./design.ts";

/** Structures in a target that no block expresses. */
const gapsOf = (target: readonly { structure: Structure }[]): Structure[] => [...new Set(target.filter((choice) => catalogEntry(choice.structure)?.fit === "gap").map((choice) => choice.structure))];

export const ACCEPTED_DESIGNS_FILE = "src/lib/map/authoring/representation/accepted-designs.json";

export type Decision = "execute" | "reduce" | "keep";
export const DECISIONS: readonly Decision[] = ["execute", "reduce", "keep"];

export type Resolution = { decision: Decision; structured: BlockKind[]; resultFingerprint: string; note: string };

export type AcceptedDesign = {
  conceptId: string;
  /** The owning domain, as the runbook's ownership rule derives it. */
  domainId: string;
  classification: "refactor" | "enhance" | "rewrite";
  /** Blocked designs need a structure no block expresses yet; they are never executed. */
  status: "actionable" | "blocked";
  blockedBy?: Structure[];
  model: Omit<ConceptModel, "context">;
  /** The record's form when it was reviewed. */
  current: { sequence: string; structured: BlockKind[] };
  /** The accepted representation, prose included. */
  target: { structure: Structure; purpose: string }[];
  justification: string;
  placements: string[];
  canonicalNote?: string;
  facetNote?: string;
  /** Fingerprint of the record the design reviewed (design.ts, contentFingerprint). */
  sourceFingerprint: string;
  /** Written by a refactor run; absent until the design has been executed, reduced or kept. */
  resolution?: Resolution;
};

export type AcceptedDesignSpec = { version: 1; designs: AcceptedDesign[] };

const recordOf = (model: MapKnowledgeModel, conceptId: string) => model.content.find((record) => record.conceptId === conceptId);

/** Block kinds the accepted target writes down; gaps have none. */
export const targetKinds = (design: Pick<AcceptedDesign, "target">): BlockKind[] =>
  [...new Set(design.target.map((choice) => catalogEntry(choice.structure)?.block).filter((kind): kind is BlockKind => kind !== undefined && STRUCTURED_KINDS.has(kind)))].sort();

/** The structured kinds a record writes down, sorted. */
export const structuredKinds = (record: MapConceptContent | undefined): BlockKind[] => (record ? [...profileOf(record).structured].sort() : []);

/** One domain's designs without resolutions: what the run was started against. */
export function designSetFingerprint(spec: AcceptedDesignSpec, domainId: string): string {
  const designs = spec.designs.filter((design) => design.domainId === domainId).map((design) => ({ ...design, resolution: undefined }));
  return createHash("sha256").update(JSON.stringify(designs)).digest("hex");
}

/** Problems that make the spec unusable as governance: shape, ownership, and freshness against the model. */
export function specProblems(spec: AcceptedDesignSpec, model: MapKnowledgeModel): string[] {
  const problems: string[] = [];
  if (spec.version !== 1) problems.push("the accepted-design spec is not version 1");
  const seen = new Set<string>();
  for (const design of spec.designs) {
    const at = design.conceptId;
    if (seen.has(at)) problems.push(`${at}: listed twice`);
    seen.add(at);
    const record = recordOf(model, at);
    if (!record) {
      problems.push(`${at}: has no content to refactor`);
      continue;
    }
    if (!["refactor", "enhance", "rewrite"].includes(design.classification)) problems.push(`${at}: classification must be refactor, enhance or rewrite (keep is never listed)`);
    const facts = placementsOf(model, at);
    if (facts.ownerDomainId !== design.domainId) problems.push(`${at}: owned by ${facts.ownerDomainId}, listed under ${design.domainId}`);
    for (const choice of design.target) if (!catalogEntry(choice.structure)) problems.push(`${at}: unknown structure "${choice.structure}"`);
    const gaps = gapsOf(design.target);
    if (design.status === "blocked" && !gaps.length) problems.push(`${at}: blocked without a missing primitive`);
    if (design.status === "actionable" && gaps.length) problems.push(`${at}: actionable but needs ${gaps.join(", ")}, which no block expresses`);
    if (design.status === "blocked" && design.resolution && design.resolution.decision !== "keep") problems.push(`${at}: a blocked design can only be resolved as keep, by re-review`);
    if (!design.justification?.trim()) problems.push(`${at}: needs a justification`);
    if (!design.resolution && design.sourceFingerprint !== contentFingerprint(record)) {
      problems.push(`${at}: the record changed since its design was accepted; review the design again`);
    }
    if (design.resolution?.decision === "keep" && design.resolution.resultFingerprint !== design.sourceFingerprint) problems.push(`${at}: kept, yet resolved to different content`);
  }
  return problems;
}

/** The spec entries an audit's design stores imply: every non-keep design, blocked where it needs a gap. */
export function exportAcceptedDesigns(stores: readonly DesignStore[], model: MapKnowledgeModel): AcceptedDesignSpec {
  const roots = model.placements.filter((placement) => !placement.parentPlacementId).sort((a, b) => a.order - b.order).map((placement) => placement.id);
  const designs: AcceptedDesign[] = [];
  for (const store of stores) {
    for (const design of Object.values(store.designs)) {
      if (design.classification === "keep") continue;
      const record = recordOf(model, design.conceptId);
      const gaps = capabilityGaps(design);
      // The analysis context is working notes, not governance: it is not persisted.
      const modelFields: AcceptedDesign["model"] = { ...design.model };
      delete (modelFields as ConceptModel).context;
      designs.push({
        conceptId: design.conceptId,
        domainId: store.domainId,
        classification: design.classification,
        status: gaps.length ? "blocked" : "actionable",
        ...(gaps.length ? { blockedBy: gaps } : {}),
        model: modelFields,
        current: { sequence: record ? profileOf(record).sequence : "", structured: structuredKinds(record) },
        target: design.representation.map((choice) => ({ structure: choice.structure, purpose: choice.purpose })),
        justification: design.reasoning,
        placements: placementsOf(model, design.conceptId).placements.map((placement) => placement.placementId),
        ...(design.canonicalNote ? { canonicalNote: design.canonicalNote } : {}),
        ...(design.facetNote ? { facetNote: design.facetNote } : {}),
        sourceFingerprint: design.contentFingerprint,
      });
    }
  }
  designs.sort((a, b) => roots.indexOf(a.domainId) - roots.indexOf(b.domainId) || a.conceptId.localeCompare(b.conceptId));
  return { version: 1, designs };
}

export type RefactorPlan = {
  domainId: string;
  title: string;
  ordinal: string;
  /** Unresolved actionable designs: what a run would reconsider. */
  actionable: AcceptedDesign[];
  blocked: AcceptedDesign[];
  resolved: AcceptedDesign[];
  /** Unresolved designs whose record changed since acceptance: a run cannot start. */
  stale: string[];
  /** The domain's other L1 concepts with content: KEEP, or designed under another domain. Protected in this run. */
  keep: string[];
  /** No actionable design was ever listed: nothing to run. */
  noop: boolean;
  /** Every actionable design is resolved (or none existed). */
  complete: boolean;
};

export function planRefactor(spec: AcceptedDesignSpec, model: MapKnowledgeModel, domainId: string): RefactorPlan {
  const root = model.placements.find((placement) => placement.id === domainId && !placement.parentPlacementId);
  if (!root) throw new Error(`${domainId} is not an L0 domain`);
  const roots = model.placements.filter((placement) => !placement.parentPlacementId).sort((a, b) => a.order - b.order);
  const listed = spec.designs.filter((design) => design.domainId === domainId);
  const actionable = listed.filter((design) => design.status === "actionable" && !design.resolution);
  const withContent = new Set(model.content.map((record) => record.conceptId));
  const topics = model.placements.filter((placement) => placement.parentPlacementId === domainId).map((placement) => placement.conceptId);
  return {
    domainId,
    title: model.concepts.find((concept) => concept.id === root.conceptId)?.title ?? domainId,
    ordinal: String(roots.findIndex((candidate) => candidate.id === domainId) + 1).padStart(2, "0"),
    actionable,
    blocked: listed.filter((design) => design.status === "blocked" && !design.resolution),
    resolved: listed.filter((design) => design.resolution),
    stale: actionable.filter((design) => design.sourceFingerprint !== contentFingerprint(recordOf(model, design.conceptId))).map((design) => design.conceptId),
    keep: [...new Set(topics)].filter((conceptId) => withContent.has(conceptId) && !listed.some((design) => design.conceptId === conceptId)),
    noop: !listed.some((design) => design.status === "actionable"),
    complete: actionable.length === 0,
  };
}

export type CampaignDomain = { domainId: string; ordinal: string; title: string; actionable: number; resolved: number; blocked: number; stale: number; state: "no work" | "complete" | "pending" | "stale" };

/** Every domain in canonical order with its refactor status, and the next one with work. */
export function refactorCampaign(spec: AcceptedDesignSpec, model: MapKnowledgeModel): { domains: CampaignDomain[]; next?: string } {
  const roots = model.placements.filter((placement) => !placement.parentPlacementId).sort((a, b) => a.order - b.order);
  const domains = roots.map((root): CampaignDomain => {
    const plan = planRefactor(spec, model, root.id);
    const state = plan.noop ? "no work" : plan.complete ? "complete" : plan.stale.length ? "stale" : "pending";
    return { domainId: root.id, ordinal: plan.ordinal, title: plan.title, actionable: plan.actionable.length, resolved: plan.resolved.length, blocked: plan.blocked.length, stale: plan.stale.length, state };
  });
  return { domains, next: domains.find((domain) => domain.state === "pending" || domain.state === "stale")?.domainId };
}

/**
 * The execution boundary for one accepted design. Keep leaves the record as
 * it was reviewed. Execute reaches exactly the accepted structured form;
 * reduce changes the record within it (a subset of the accepted structures,
 * or of those it already had). A refactor or enhancement keeps the definition
 * and the legacy fields: changing them would be a rewrite, which needs its own
 * accepted design.
 */
export function decisionProblems(design: AcceptedDesign, base: MapConceptContent | undefined, head: MapConceptContent | undefined, decision: Decision): string[] {
  const at = design.conceptId;
  if (design.status !== "actionable") return [`${at}: blocked by ${design.blockedBy?.join(", ") ?? "a missing primitive"}; it cannot be changed in a refactor run`];
  if (!base || !head) return [`${at}: content missing`];
  if (contentFingerprint(base) !== design.sourceFingerprint) return [`${at}: the base record is not the one the design reviewed`];
  const changed = contentFingerprint(head) !== contentFingerprint(base);
  if (decision === "keep") return changed ? [`${at}: kept, so the record must stay exactly as reviewed`] : [];
  if (!changed) return [`${at}: decision "${decision}" but the record is unchanged; record keep instead`];
  const problems: string[] = [];
  const target = targetKinds(design);
  const before = structuredKinds(base);
  const after = structuredKinds(head);
  const outside = after.filter((kind) => !target.includes(kind) && !before.includes(kind));
  if (outside.length) problems.push(`${at}: uses ${outside.join(", ")}, which the accepted design does not include; a different representation needs a new accepted design`);
  if (decision === "execute" && JSON.stringify(after) !== JSON.stringify(target)) {
    problems.push(`${at}: execute must reach the accepted structured form (${target.join(", ") || "prose only"}), found ${after.join(", ") || "prose only"}; record reduce for a smaller change`);
  }
  if (design.classification !== "rewrite") {
    for (const field of ["definition", "summary", "explanation", "whyItMatters"] as const) {
      if (base[field] !== head[field]) problems.push(`${at}: ${field} changed; a ${design.classification} keeps it, and rewriting needs an accepted rewrite design`);
    }
  }
  return problems;
}

/** Writes each recorded decision into the domain's designs as its resolution. Pure. */
export function resolveSpec(spec: AcceptedDesignSpec, decisions: Record<string, { decision: Decision; note: string }>, model: MapKnowledgeModel): AcceptedDesignSpec {
  return {
    ...spec,
    designs: spec.designs.map((design) => {
      const recorded = decisions[design.conceptId];
      if (!recorded) return design;
      const record = recordOf(model, design.conceptId);
      return { ...design, resolution: { decision: recorded.decision, structured: structuredKinds(record), resultFingerprint: contentFingerprint(record), note: recorded.note } };
    }),
  };
}

/**
 * Re-reviews a blocked design outside any run. When reconsideration shows its
 * missing structure does not belong at the concept (it would teach another
 * concept's mechanism, say), the design is resolved as keep. Keep is the only
 * outcome: a blocked design cannot be executed, a different representation
 * needs a new accepted design, and the record must be exactly the one reviewed.
 */
export function reviewBlockedDesign(spec: AcceptedDesignSpec, model: MapKnowledgeModel, conceptId: string, note: string): { spec?: AcceptedDesignSpec; problems: string[] } {
  const design = spec.designs.find((candidate) => candidate.conceptId === conceptId);
  const problems: string[] = [];
  if (!design) problems.push(`${conceptId}: has no accepted design`);
  else if (design.status !== "blocked") problems.push(`${conceptId}: not blocked; an actionable design is resolved by a refactor run`);
  else if (design.resolution) problems.push(`${conceptId}: already resolved (${design.resolution.decision})`);
  else if (contentFingerprint(recordOf(model, conceptId)) !== design.sourceFingerprint) problems.push(`${conceptId}: the record changed since its design was accepted; review the design again`);
  if (!note.trim()) problems.push(`${conceptId}: a re-review needs a note giving its reason`);
  return problems.length ? { problems } : { spec: resolveSpec(spec, { [conceptId]: { decision: "keep", note } }, model), problems };
}

/** The spec may change only by resolving this run's designs: nothing else, and no other domain. */
export function specDiffProblems(base: AcceptedDesignSpec, head: AcceptedDesignSpec, resolvedNow: readonly string[]): string[] {
  const problems: string[] = [];
  const strip = (design: AcceptedDesign) => JSON.stringify({ ...design, resolution: undefined });
  const before = new Map(base.designs.map((design) => [design.conceptId, design]));
  const after = new Map(head.designs.map((design) => [design.conceptId, design]));
  if (JSON.stringify([...before.keys()]) !== JSON.stringify([...after.keys()])) problems.push("accepted designs were added, removed or reordered");
  for (const [conceptId, design] of after) {
    const old = before.get(conceptId);
    if (!old) continue;
    if (strip(old) !== strip(design)) problems.push(`${conceptId}: its accepted design changed; only its resolution may be written`);
    const resolutionChanged = JSON.stringify(old.resolution ?? null) !== JSON.stringify(design.resolution ?? null);
    if (resolutionChanged && !resolvedNow.includes(conceptId)) problems.push(`${conceptId}: resolution changed outside this run's decisions`);
    if (!resolutionChanged && resolvedNow.includes(conceptId)) problems.push(`${conceptId}: decided in this run but not resolved in the spec`);
  }
  return problems;
}

export const refactorBranch = (domainId: string) => `refactor/map-${domainId}-l1-representations`;
/** Branches of MAP domain runs of either kind: one open PR among them blocks starting another run. */
export const MAP_RUN_BRANCH = /^(feat\/map-.*-l1|refactor\/map-.*-l1-representations)$/;
