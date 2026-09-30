/**
 * Domain planning for the MAP L1 authoring orchestrator (docs/map-authoring/
 * domain-runbook.md). Development tooling only: it classifies one L0
 * domain's L1 topics from repository state, through the existing authoring
 * inspector, without a resolver of its own.
 *
 * Ownership follows the authoring contract (content-architecture.md):
 * - content registered and present: already authored;
 * - one child layer, carried in this domain: owned here, even when the
 *   preferred placement is a leaf elsewhere;
 * - several child layers (the facet rule): owned by the domain of the
 *   preferred placement, deferred elsewhere;
 * - anything the contract does not settle is a stop, never a guess.
 */
import type { MapKnowledgeModel } from "../../types.ts";
import { createMapResolver } from "../../resolver.ts";
import { createMapAuthoringInspector, type MapChildLayer } from "../context.ts";

export type TopicStatus = "authored" | "eligible" | "deferred" | "stop";

export type DomainTopic = {
  placementId: string;
  conceptId: string;
  label: string;
  status: TopicStatus;
  /** Why the topic is deferred or stops the run; absent otherwise. */
  reason?: string;
  preferredPlacementId?: string;
  /** Several child-carrying placements: the facet rule applies. */
  facet: boolean;
  carriers: MapChildLayer[];
  /** Every placement of the concept, this one first. */
  placements: string[];
  childCount: number;
  childrenWithContent: number;
};

export type DomainPlan = {
  domainId: string;
  title: string;
  ordinal: string;
  topics: DomainTopic[];
  authored: string[];
  eligible: string[];
  deferred: { conceptId: string; reason: string }[];
  stops: { conceptId: string; reason: string }[];
  /** Every topic owned by this domain is authored. */
  complete: boolean;
};

type Options = { authoredContent?: readonly string[] };

export function planDomain(model: MapKnowledgeModel, domainId: string, options: Options = {}): DomainPlan {
  const inspector = createMapAuthoringInspector(model, options);
  const status = inspector.inspectDomain(domainId);
  const titleOf = (placementId: string) => {
    const placement = model.placements.find((candidate) => candidate.id === placementId);
    return model.concepts.find((concept) => concept.id === placement?.conceptId)?.title ?? placementId;
  };
  const topics = status.l1.map((entry): DomainTopic => {
    const context = inspector.inspectConcept(entry.conceptId, { contextPlacementId: entry.placementId });
    const carriers = context.childLayers.carriers;
    const base = {
      placementId: entry.placementId,
      conceptId: entry.conceptId,
      label: entry.label,
      preferredPlacementId: context.preferredPlacementId,
      facet: carriers.length > 1,
      carriers,
      placements: context.placements.map((placement) => placement.placementId),
      childCount: entry.childCount,
      childrenWithContent: entry.childrenWithContent,
    };
    if (context.registration === "content-not-registered" || context.registration === "registered-without-content") {
      return { ...base, status: "stop", reason: `registry inconsistency (${context.registration})` };
    }
    if (context.registration === "registered") return { ...base, status: "authored" };

    if (carriers.length > 1) {
      const owner = carriers.find((carrier) => carrier.isPreferred);
      if (!owner) {
        return { ...base, status: "stop", reason: "several child layers, but the preferred placement carries none of them: ownership is unclear" };
      }
      return owner.domainId === domainId
        ? { ...base, status: "eligible" }
        : { ...base, status: "deferred", reason: `facet rule: authoring owned by ${titleOf(owner.domainId)} (preferred placement ${owner.placementId})` };
    }
    const layer = carriers[0];
    const ownerDomain = layer?.domainId ?? context.placements.find((placement) => placement.isPreferred)?.domain.placementId ?? domainId;
    return ownerDomain === domainId
      ? { ...base, status: "eligible" }
      : { ...base, status: "deferred", reason: `its child layer is carried by ${layer?.placementId} in ${titleOf(ownerDomain)}` };
  });
  const pick = (wanted: TopicStatus) => topics.filter((topic) => topic.status === wanted);
  return {
    domainId,
    title: status.domain.label,
    ordinal: status.domainOrdinal,
    topics,
    authored: pick("authored").map((topic) => topic.conceptId),
    eligible: pick("eligible").map((topic) => topic.conceptId),
    deferred: pick("deferred").map((topic) => ({ conceptId: topic.conceptId, reason: topic.reason! })),
    stops: pick("stop").map((topic) => ({ conceptId: topic.conceptId, reason: topic.reason! })),
    complete: pick("eligible").length === 0 && pick("stop").length === 0,
  };
}

export type DomainSummary = Pick<DomainPlan, "domainId" | "title" | "ordinal" | "complete"> & {
  authored: number;
  eligible: number;
  deferred: number;
  stops: number;
};

/** Every L0 domain in canonical order with its L1 authoring status. */
export function listDomains(model: MapKnowledgeModel, options: Options = {}): DomainSummary[] {
  const roots = model.placements.filter((placement) => !placement.parentPlacementId).sort((a, b) => a.order - b.order);
  return roots.map((root) => {
    const plan = planDomain(model, root.id, options);
    return {
      domainId: plan.domainId,
      title: plan.title,
      ordinal: plan.ordinal,
      complete: plan.complete,
      authored: plan.authored.length,
      eligible: plan.eligible.length,
      deferred: plan.deferred.length,
      stops: plan.stops.length,
    };
  });
}

/** The first domain in canonical order with owned work left. Informational only: never starts a run. */
export function nextIncompleteDomain(model: MapKnowledgeModel, options: Options = {}): DomainSummary | undefined {
  return listDomains(model, options).find((domain) => !domain.complete);
}

export type RenderExpectation = {
  conceptId: string;
  placements: {
    placementId: string;
    /** Exactly the rows expected directly beneath the placement, in order; none at a leaf. */
    children: string[];
    /** Child placements of the concept's other carriers, which must not render with this one. */
    foreignChildren: string[];
  }[];
};

/**
 * What a render check must verify after authoring these concepts, derived from
 * the model through the MAP resolver: every placement of each concept with its
 * exact children, and the other facets' children that must not leak into it.
 */
export function renderExpectations(model: MapKnowledgeModel, conceptIds: readonly string[]): RenderExpectation[] {
  const resolver = createMapResolver(model);
  return conceptIds.map((conceptId) => {
    const placementIds = resolver.getPlacementsForConcept(conceptId).map((placement) => placement.id).sort();
    const childrenOf = new Map(placementIds.map((placementId) => [placementId, resolver.getChildren(placementId).map((child) => child.id)]));
    return {
      conceptId,
      placements: placementIds.map((placementId) => ({
        placementId,
        children: childrenOf.get(placementId)!,
        foreignChildren: placementIds.filter((other) => other !== placementId).flatMap((other) => childrenOf.get(other)!),
      })),
    };
  });
}

/**
 * Authored concepts that together exercise every render shape the model has:
 * several child-carrying placements (facets), a carrier with leaf placements,
 * and a single placement. Used to verify a browser-harness fix on a tree
 * without the run's content.
 */
export function renderSample(model: MapKnowledgeModel, authored: readonly string[]): string[] {
  const shapes = new Map<string, string>();
  for (const { conceptId, placements } of renderExpectations(model, authored)) {
    const carriers = placements.filter((placement) => placement.children.length > 0).length;
    const shape = carriers > 1 ? "facets" : placements.length > 1 ? "leaves" : "single";
    if (!shapes.has(shape)) shapes.set(shape, conceptId);
  }
  return [...shapes.values()];
}
