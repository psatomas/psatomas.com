/**
 * The read-only representation audit (docs/map-authoring/representation-
 * design.md): for each concept in scope, its placements, current form and
 * recorded design, plus descriptive usage across the corpus. Pure: it reads a
 * model and design stores and returns data. It never changes content, and the
 * aggregates describe the corpus; they are never quality targets.
 */
import type { MapKnowledgeModel } from "../../types.ts";
import type { BlockKind, Structure } from "./catalog.ts";
import { capabilityGaps, designStatus, placementsOf, profileOf, type Classification, type ConceptPlacements, type DesignStatus, type DesignStore, type RepresentationProfile, type StoredDesign } from "./design.ts";

export type AuditScope = { conceptId: string } | { domainId: string } | { all: true };

export type ConceptAuditEntry = {
  conceptId: string;
  title: string;
  facts: ConceptPlacements;
  current: RepresentationProfile;
  status: DesignStatus;
  problems: string[];
  design?: StoredDesign;
  capabilityGaps: Structure[];
};

const depthOf = (model: MapKnowledgeModel, placementId: string): number => {
  const placement = model.placements.find((candidate) => candidate.id === placementId);
  return placement?.parentPlacementId ? 1 + depthOf(model, placement.parentPlacementId) : 0;
};

/** Concepts with content placed at `level`, in canonical order: by owning domain, then sibling order. */
export function conceptsAtLevel(model: MapKnowledgeModel, level: number): string[] {
  const withContent = new Set(model.content.map((record) => record.conceptId));
  const roots = model.placements.filter((placement) => !placement.parentPlacementId).sort((a, b) => a.order - b.order).map((placement) => placement.id);
  const ordered: string[] = [];
  const visit = (placementId: string) => {
    for (const child of model.placements.filter((placement) => placement.parentPlacementId === placementId).sort((a, b) => a.order - b.order)) {
      if (depthOf(model, child.id) === level && withContent.has(child.conceptId) && !ordered.includes(child.conceptId)) ordered.push(child.conceptId);
      if (depthOf(model, child.id) < level) visit(child.id);
    }
  };
  roots.forEach(visit);
  return ordered;
}

export function auditRepresentation(model: MapKnowledgeModel, stores: readonly DesignStore[], scope: AuditScope, level = 1): ConceptAuditEntry[] {
  const designs = new Map<string, StoredDesign>(stores.flatMap((store) => Object.entries(store.designs)));
  const atLevel = conceptsAtLevel(model, level);
  let conceptIds: string[];
  if ("conceptId" in scope) {
    if (!atLevel.includes(scope.conceptId)) throw new Error(`${scope.conceptId} is not an L${level} concept with content`);
    conceptIds = [scope.conceptId];
  } else conceptIds = atLevel;
  const entries = conceptIds.map((conceptId): ConceptAuditEntry => {
    const record = model.content.find((candidate) => candidate.conceptId === conceptId)!;
    const facts = placementsOf(model, conceptId);
    const design = designs.get(conceptId);
    const { status, problems } = designStatus(design, record, facts);
    return {
      conceptId,
      title: model.concepts.find((concept) => concept.id === conceptId)?.title ?? conceptId,
      facts,
      current: profileOf(record),
      status,
      problems,
      ...(design ? { design } : {}),
      capabilityGaps: design && status === "designed" ? capabilityGaps(design) : [],
    };
  });
  return "domainId" in scope ? entries.filter((entry) => entry.facts.ownerDomainId === scope.domainId) : entries;
}

export type UsageSummary = { records: number; proseOnly: number; kinds: Partial<Record<BlockKind, number>>; recordsUsing: Partial<Record<BlockKind, number>> };

/** Block usage over a set of records: descriptive only. */
export function usageOf(model: MapKnowledgeModel, conceptIds: readonly string[]): UsageSummary {
  const summary: UsageSummary = { records: 0, proseOnly: 0, kinds: {}, recordsUsing: {} };
  for (const conceptId of conceptIds) {
    const record = model.content.find((candidate) => candidate.conceptId === conceptId);
    if (!record) continue;
    const profile = profileOf(record);
    summary.records++;
    if (profile.proseOnly) summary.proseOnly++;
    for (const [kind, count] of Object.entries(profile.kinds) as [BlockKind, number][]) {
      summary.kinds[kind] = (summary.kinds[kind] ?? 0) + count;
      summary.recordsUsing[kind] = (summary.recordsUsing[kind] ?? 0) + 1;
    }
  }
  return summary;
}

export type AuditAggregate = {
  concepts: number;
  status: Partial<Record<DesignStatus, number>>;
  classification: Partial<Record<Classification, number>>;
  recommended: Partial<Record<Structure, number>>;
  capabilityGaps: Partial<Record<Structure, number>>;
};

/** Counts over audit entries: what was found, never what should be. */
export function aggregate(entries: readonly ConceptAuditEntry[]): AuditAggregate {
  const result: AuditAggregate = { concepts: entries.length, status: {}, classification: {}, recommended: {}, capabilityGaps: {} };
  const bump = <K extends string>(map: Partial<Record<K, number>>, key: K) => (map[key] = (map[key] ?? 0) + 1);
  for (const entry of entries) {
    bump(result.status, entry.status);
    if (entry.status !== "designed" || !entry.design) continue;
    bump(result.classification, entry.design.classification);
    for (const structure of new Set(entry.design.representation.map((choice) => choice.structure))) bump(result.recommended, structure);
    for (const gap of entry.capabilityGaps) bump(result.capabilityGaps, gap);
  }
  return result;
}

/** What a read-only command must leave exactly as it found it. */
export type RepositorySnapshot = { head: string; branch: string; contentFiles: Record<string, string> };

/** Any difference is a mutation the representation audit must never make. */
export function mutations(before: RepositorySnapshot, after: RepositorySnapshot): string[] {
  const problems: string[] = [];
  if (before.head !== after.head) problems.push(`HEAD moved from ${before.head.slice(0, 7)} to ${after.head.slice(0, 7)}`);
  if (before.branch !== after.branch) problems.push(`branch changed from ${before.branch} to ${after.branch}`);
  for (const file of new Set([...Object.keys(before.contentFiles), ...Object.keys(after.contentFiles)])) {
    if (before.contentFiles[file] !== after.contentFiles[file]) problems.push(`${file} changed`);
  }
  return problems;
}

/** Designs bind to accepted content: uncommitted changes to content files would bind them to something else. */
export const acceptedContentProblems = (trackedChanges: readonly string[], contentFiles: readonly string[]) =>
  trackedChanges.filter((file) => contentFiles.includes(file)).map((file) => `${file} has uncommitted changes; the representation audit judges accepted content only`);
