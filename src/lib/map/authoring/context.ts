/**
 * Bounded authoring context for one canonical MAP concept: development tooling
 * for writing canonical exposition (docs/map-authoring/), never imported by
 * the MAP runtime. It reads the static knowledge model through the canonical
 * resolver and returns only the neighbourhood an author needs: the concept,
 * each of its placements with ancestry, parent, siblings and children, the
 * exposition around it, and the facts that constrain what it may say.
 *
 * Level is never a property of the concept: it is each placement's depth in
 * the taxonomy forest, and one concept may be L1 in one context and L2 in
 * another while owning a single canonical exposition that must serve both.
 */
import { MAP_RELATIONSHIP_TYPES } from "../types.ts";
import type { MapConceptContent, MapContentBlock, MapFlowElement, MapKnowledgeModel, MapPlacement } from "../types.ts";
import { createMapResolver, type MapResolver } from "../resolver.ts";
import { MapKnowledgeValidationError } from "../validation.ts";

export type MapAuthoringErrorCode = "invalid-model" | "unknown-concept" | "unknown-context" | "context-mismatch" | "unknown-domain";

export class MapAuthoringContextError extends Error {
  readonly code: MapAuthoringErrorCode;

  constructor(code: MapAuthoringErrorCode, message: string) {
    super(message);
    this.name = "MapAuthoringContextError";
    this.code = code;
  }
}

/** One placement as it appears in someone else's context. */
export type MapAuthoringPlacementRef = {
  placementId: string;
  conceptId: string;
  /** What the explorer shows: the contextual label, else the concept title. */
  label: string;
  depth: number;
  /** Whether the referenced placement's canonical concept owns exposition. */
  hasContent: boolean;
};

export type MapAuthoringChildRef = MapAuthoringPlacementRef & {
  /** How many placements the child's concept has in total (1 = taught only here). */
  conceptPlacementCount: number;
};

/** A heading-delimited part of an exposition, as plain lines. */
export type MapExpositionSection = {
  /** Position among the exposition's sections (text before the first heading, if any, is the first). */
  index: number;
  heading?: string;
  lines: string[];
};

export type MapAuthoringParent = MapAuthoringPlacementRef & {
  /** The part of the parent's exposition that covers this placement, when it can be located. */
  section?: MapExpositionSection;
  /** Headings of the parent's exposition, for orientation when no section is located. */
  headings: string[];
};

export type MapAuthoringPlacementContext = MapAuthoringPlacementRef & {
  level: string;
  title: string;
  contextualLabel?: string;
  contextualNote?: string;
  isPreferred: boolean;
  isPrimary: boolean;
  /** Root-first ancestry ending with this placement. */
  trail: MapAuthoringPlacementRef[];
  domain: MapAuthoringPlacementRef;
  /** The containing L0 domain's canonical two-digit ordinal, as the explorer shows it. */
  domainOrdinal: string;
  parent?: MapAuthoringParent;
  /** All placements under the same parent, in sibling order, including this one. */
  siblings: MapAuthoringPlacementRef[];
  children: MapAuthoringChildRef[];
};

export type MapAuthoringRelation = {
  id: string;
  direction: "outgoing" | "incoming";
  typeId: string;
  /** The relation as read from this concept ("depends on", "is depended on by"). */
  label: string;
  conceptId: string;
  title: string;
};

export type MapConceptAuthoringContext = {
  concept: { id: string; title: string };
  content: {
    exists: boolean;
    contentId?: string;
    /** The exposition as the reader meets it: definition, legacy prose fields, then body. */
    lines: string[];
    blockKinds: Record<string, number>;
  };
  preferredPlacementId?: string;
  primaryPlacementId?: string;
  primarySource: "explicit" | "preferred" | "unplaced";
  /** Distinct levels at which the concept is placed, e.g. ["L1", "L2"]. */
  levels: string[];
  /** Primary placement first, then the others by L0 domain order, depth and ID. */
  placements: MapAuthoringPlacementContext[];
  relationships: MapAuthoringRelation[];
  mechanisms: { id: string; title: string; role: "owner" | "step" }[];
  knowledgePaths: { id: string; title: string }[];
  /** Other concepts with the same title: distinct identities an author must not merge. */
  sameTitleConcepts: string[];
  /** Facts about this concept that change what its exposition may do. */
  attention: string[];
};

export type MapDomainAuthoringEntry = MapAuthoringPlacementRef & {
  /** The concept's preferred placement when it is not this L1 placement. */
  preferredElsewhere?: string;
  /** Levels at which this L1 topic's concept is placed anywhere in MAP. */
  levels: string[];
  conceptPlacementCount: number;
  childCount: number;
  childrenWithContent: number;
};

export type MapDomainAuthoringStatus = {
  domain: MapAuthoringPlacementRef;
  domainOrdinal: string;
  l1: MapDomainAuthoringEntry[];
};

const levelOf = (depth: number) => `L${depth}`;

/** One exposition block as a plain, deterministic line (never markup). */
export function describeMapContentBlock(block: MapContentBlock): string {
  const element = (value: MapFlowElement) => (typeof value === "string" ? value : value.join(" > "));
  switch (block.kind) {
    case "paragraph":
      return block.text;
    case "heading":
      return `## ${block.text}`;
    case "flow":
      return `[flow] ${block.label}: ${block.stages
        .map((stage) => (stage.length === 1 ? element(stage[0]) : `(${stage.map(element).join(" | ")})`))
        .join(" → ")}`;
    case "distinction":
      return `[distinction] ${[block.left, block.right, ...(block.further ?? [])].join(" ≠ ")}`;
    case "tensions":
      return `[tensions] ${block.label}: ${block.pairs.map(([left, right]) => `${left} ↔ ${right}`).join("; ")}`;
    case "terms":
      return `[terms] ${block.terms.join(" · ")}`;
  }
}

function expositionLines(content: MapConceptContent): string[] {
  const prose = [content.definition, content.summary, content.explanation, content.whyItMatters].filter(
    (text): text is string => Boolean(text),
  );
  return [...prose, ...(content.body ?? []).map(describeMapContentBlock)];
}

/** Splits a body at its headings; blocks before the first heading form section 0. */
function sections(body: readonly MapContentBlock[]): { heading?: string; blocks: MapContentBlock[] }[] {
  const result: { heading?: string; blocks: MapContentBlock[] }[] = [{ blocks: [] }];
  for (const block of body) {
    if (block.kind === "heading") result.push({ heading: block.text, blocks: [block] });
    else result[result.length - 1].blocks.push(block);
  }
  return result.filter((section) => section.blocks.length > 0);
}

const lower = (values: readonly string[]) => values.map((value) => value.toLowerCase());
const sameTerms = (left: readonly string[], right: readonly string[]) =>
  left.length === right.length && lower(left).every((term, index) => term === lower(right)[index]);

/**
 * The part of a parent's exposition that is divided among its children. An
 * exposition that ends by naming the parent's own children in a terms strip
 * (the L0 convention) closes each child's section with a strip of its own;
 * whatever follows the last of those, up to the summary strip, is closing
 * material about the parent as a whole (possibly under its own heading), and
 * belongs to no child's section. Without such a summary nothing is dropped.
 */
function sectionedBody(body: readonly MapContentBlock[], siblingLabels: readonly string[]): readonly MapContentBlock[] {
  const summary = body.findLastIndex((block) => block.kind === "terms" && sameTerms(block.terms, siblingLabels));
  if (summary < 0) return body;
  return body.slice(0, body.slice(0, summary).findLastIndex((block) => block.kind === "terms") + 1);
}

/**
 * Locates the part of a parent's exposition that covers one child placement.
 * L0 expositions close each L1 section with a terms strip naming that topic's
 * own children, so a section whose strip equals the placement's child labels
 * is its section. Otherwise a single section mentioning the placement's label
 * (in a heading or a terms strip) is used; anything else is left to the author.
 * Sections never include the parent's closing material (see sectionedBody).
 */
function locateSection(
  parentContent: MapConceptContent,
  label: string,
  childLabels: readonly string[],
  siblingLabels: readonly string[],
): MapExpositionSection | undefined {
  const all = sections(sectionedBody(parentContent.body ?? [], siblingLabels));
  const toSection = (index: number): MapExpositionSection => ({
    index,
    heading: all[index].heading,
    lines: all[index].blocks.map(describeMapContentBlock),
  });
  if (childLabels.length > 0) {
    const byStrip = all.findIndex((section) =>
      section.blocks.some((block) => block.kind === "terms" && sameTerms(block.terms, childLabels)),
    );
    if (byStrip >= 0) return toSection(byStrip);
  }
  const needle = label.toLowerCase();
  const mentions = all
    .map((section, index) => ({ section, index }))
    .filter(({ section }) =>
      section.blocks.some(
        (block) =>
          (block.kind === "heading" && block.text.toLowerCase().includes(needle)) ||
          (block.kind === "terms" && lower(block.terms).includes(needle)),
      ),
    );
  return mentions.length === 1 ? toSection(mentions[0].index) : undefined;
}

export function createMapAuthoringInspector(model: MapKnowledgeModel) {
  let resolver: MapResolver;
  try {
    resolver = createMapResolver(model);
  } catch (error) {
    if (error instanceof MapKnowledgeValidationError) {
      throw new MapAuthoringContextError("invalid-model", `MAP knowledge data is structurally invalid:\n${error.errors.map((e) => `- ${e}`).join("\n")}`);
    }
    throw error;
  }

  const roots = resolver.getRootPlacements().map((placement) => placement.id);
  const ordinalOf = (domainId: string) => String(roots.indexOf(domainId) + 1).padStart(2, "0");
  const titleOf = (conceptId: string) => resolver.getConcept(conceptId)?.title ?? conceptId;
  const labelOf = (placement: MapPlacement) => placement.contextualLabel ?? titleOf(placement.conceptId);
  const hasContent = (conceptId: string) => resolver.getContentForConcept(conceptId) !== undefined;
  const depthOf = (placementId: string) => resolver.getAncestors(placementId).length;
  const domainOf = (placementId: string) => resolver.getAncestors(placementId)[0]?.id ?? placementId;
  const ref = (placement: MapPlacement): MapAuthoringPlacementRef => ({
    placementId: placement.id,
    conceptId: placement.conceptId,
    label: labelOf(placement),
    depth: depthOf(placement.id),
    hasContent: hasContent(placement.conceptId),
  });
  const levelsOf = (conceptId: string) =>
    [...new Set(resolver.getPlacementsForConcept(conceptId).map((placement) => depthOf(placement.id)))]
      .sort((a, b) => a - b)
      .map(levelOf);
  const siblingsOf = (placement: MapPlacement) =>
    placement.parentPlacementId ? resolver.getChildren(placement.parentPlacementId) : resolver.getRootPlacements();

  function placementContext(placement: MapPlacement, preferredId: string | undefined, primaryId: string | undefined): MapAuthoringPlacementContext {
    const self = ref(placement);
    const children = resolver.getChildren(placement.id);
    const parentPlacement = placement.parentPlacementId ? resolver.getPlacement(placement.parentPlacementId) : undefined;
    let parent: MapAuthoringParent | undefined;
    if (parentPlacement) {
      const parentContent = resolver.getContentForConcept(parentPlacement.conceptId);
      parent = {
        ...ref(parentPlacement),
        section: parentContent ? locateSection(parentContent, self.label, children.map(labelOf), siblingsOf(placement).map(labelOf)) : undefined,
        headings: (parentContent?.body ?? []).flatMap((block) => (block.kind === "heading" ? [block.text] : [])),
      };
    }
    const domain = resolver.getPlacement(domainOf(placement.id))!;
    return {
      ...self,
      level: levelOf(self.depth),
      title: titleOf(placement.conceptId),
      ...(placement.contextualLabel ? { contextualLabel: placement.contextualLabel } : {}),
      ...(placement.contextualNote ? { contextualNote: placement.contextualNote } : {}),
      isPreferred: placement.id === preferredId,
      isPrimary: placement.id === primaryId,
      trail: [...resolver.getAncestors(placement.id), placement].map(ref),
      domain: ref(domain),
      domainOrdinal: ordinalOf(domain.id),
      ...(parent ? { parent } : {}),
      siblings: siblingsOf(placement).map(ref),
      children: children.map((child) => ({
        ...ref(child),
        conceptPlacementCount: resolver.getPlacementsForConcept(child.conceptId).length,
      })),
    };
  }

  function inspectConcept(conceptId: string, options: { contextPlacementId?: string } = {}): MapConceptAuthoringContext {
    const concept = resolver.getConcept(conceptId);
    if (!concept) {
      const placement = resolver.getPlacement(conceptId);
      throw new MapAuthoringContextError(
        "unknown-concept",
        placement
          ? `"${conceptId}" is not a concept; it is a placement of concept "${placement.conceptId}". Inspect "${placement.conceptId}" with --context ${conceptId}.`
          : `Unknown MAP concept "${conceptId}".`,
      );
    }
    const placements = resolver.getPlacementsForConcept(concept.id);
    let primary: MapPlacement | undefined;
    let primarySource: MapConceptAuthoringContext["primarySource"];
    if (options.contextPlacementId !== undefined) {
      const selected = resolver.getPlacement(options.contextPlacementId);
      if (!selected) throw new MapAuthoringContextError("unknown-context", `Unknown placement "${options.contextPlacementId}".`);
      if (selected.conceptId !== concept.id) {
        throw new MapAuthoringContextError(
          "context-mismatch",
          `Placement "${selected.id}" belongs to concept "${selected.conceptId}", not "${concept.id}". Placements of "${concept.id}": ${placements.map((placement) => placement.id).join(", ") || "none"}.`,
        );
      }
      primary = selected;
      primarySource = "explicit";
    } else {
      primary = resolver.getPreferredPlacementForConcept(concept.id);
      primarySource = primary ? "preferred" : "unplaced";
    }
    const preferredId = resolver.getPreferredPlacementForConcept(concept.id)?.id;
    const others = placements
      .filter((placement) => placement.id !== primary?.id)
      .sort(
        (a, b) =>
          roots.indexOf(domainOf(a.id)) - roots.indexOf(domainOf(b.id)) ||
          depthOf(a.id) - depthOf(b.id) ||
          a.id.localeCompare(b.id),
      );
    const contexts = [...(primary ? [primary] : []), ...others].map((placement) => placementContext(placement, preferredId, primary?.id));

    const content = resolver.getContentForConcept(concept.id);
    const blockKinds: Record<string, number> = {};
    for (const block of content?.body ?? []) blockKinds[block.kind] = (blockKinds[block.kind] ?? 0) + 1;

    const relationships: MapAuthoringRelation[] = [
      ...resolver.getRelationshipsFrom(concept.id).map((relationship) => ({
        id: relationship.id,
        direction: "outgoing" as const,
        typeId: relationship.typeId,
        label: MAP_RELATIONSHIP_TYPES[relationship.typeId].label,
        conceptId: relationship.targetConceptId,
        title: titleOf(relationship.targetConceptId),
      })),
      ...resolver.getRelationshipsTo(concept.id).map((relationship) => ({
        id: relationship.id,
        direction: "incoming" as const,
        typeId: relationship.typeId,
        label: MAP_RELATIONSHIP_TYPES[relationship.typeId].inverseLabel,
        conceptId: relationship.sourceConceptId,
        title: titleOf(relationship.sourceConceptId),
      })),
    ];
    const mechanisms = model.mechanisms
      .filter((mechanism) => mechanism.conceptId === concept.id || mechanism.steps.some((step) => step.conceptId === concept.id))
      .map((mechanism) => ({ id: mechanism.id, title: mechanism.title, role: mechanism.conceptId === concept.id ? ("owner" as const) : ("step" as const) }));
    const knowledgePaths = model.knowledgePaths
      .filter((path) => path.conceptIds.includes(concept.id))
      .map((path) => ({ id: path.id, title: path.title }));
    const sameTitleConcepts = model.concepts
      .filter((other) => other.id !== concept.id && other.title === concept.title)
      .map((other) => other.id)
      .sort();
    const levels = levelsOf(concept.id);
    const primaryContext = contexts.find((context) => context.isPrimary);

    const attention: string[] = [];
    if (contexts.length === 0) {
      attention.push("The concept has no placement: no reader reaches its exposition through the explorer.");
    }
    if (levels.length > 1) {
      attention.push(
        `Placed at ${levels.join(" and ")} (${contexts.map((context) => `${context.level} ${context.placementId}`).join(", ")}): one canonical exposition must serve every role.`,
      );
    }
    if (contexts.length > 1) {
      attention.push(`${contexts.length} placements: the exposition renders identically at each; write nothing that is true only in one of them.`);
      const branches = contexts.filter((context) => context.children.length > 0);
      if (branches.length > 0 && branches.length < contexts.length) {
        attention.push(
          `Only ${branches.map((context) => context.placementId).join(", ")} carries the concept's children; at its other placements it is a leaf, where the same exposition must read as a complete explanation.`,
        );
      }
    }
    const layer = contexts.find((context) => context.children.length > 0);
    if (primaryContext && primaryContext.children.length === 0 && layer) {
      attention.push(`The primary context is a leaf; the concept's own layer of children is at ${layer.placementId} (${layer.level}). To author its synthesis role, inspect with --context ${layer.placementId}.`);
    }
    if (primarySource === "explicit" && primary?.id !== preferredId) {
      attention.push(`The selected context "${primary?.id}" is not the preferred placement "${preferredId}".`);
    }
    if (content) attention.push(`Canonical content "${content.id}" already exists: revising it changes every placement.`);
    const authoredChildren = primaryContext?.children.filter((child) => child.hasContent) ?? [];
    if (authoredChildren.length > 0) {
      attention.push(`Children with their own exposition: ${authoredChildren.map((child) => child.conceptId).join(", ")}. Relate to them; do not restate them.`);
    }
    if (primaryContext?.parent && !primaryContext.parent.hasContent) {
      attention.push(`The parent "${primaryContext.parent.conceptId}" has no exposition yet.`);
    }
    if (primaryContext?.parent?.hasContent && !primaryContext.parent.section) {
      attention.push(`No single section of the parent's exposition covers this placement; read the parent with: npm run map:inspect -- ${primaryContext.parent.conceptId}`);
    }
    if (sameTitleConcepts.length > 0) {
      attention.push(`Other concepts share the title "${concept.title}": ${sameTitleConcepts.join(", ")}. They are distinct identities; keep their meanings apart.`);
    }
    const relabelled = contexts.filter((context) => context.contextualLabel);
    if (relabelled.length > 0) {
      attention.push(
        `Contextual labels differ from the title "${concept.title}": ${relabelled.map((context) => `"${context.contextualLabel}" at ${context.placementId}`).join(", ")}. The label is presentation; the exposition belongs to the concept.`,
      );
    }

    return {
      concept: { id: concept.id, title: concept.title },
      content: {
        exists: Boolean(content),
        ...(content ? { contentId: content.id } : {}),
        lines: content ? expositionLines(content) : [],
        blockKinds,
      },
      ...(preferredId ? { preferredPlacementId: preferredId } : {}),
      ...(primary ? { primaryPlacementId: primary.id } : {}),
      primarySource,
      levels,
      placements: contexts,
      relationships,
      mechanisms,
      knowledgePaths,
      sameTitleConcepts,
      attention,
    };
  }

  /** A domain's L1 topics in sibling order, with their authoring status. */
  function inspectDomain(domainId: string): MapDomainAuthoringStatus {
    const domain = resolver.getPlacement(domainId);
    if (!domain || domain.parentPlacementId) {
      throw new MapAuthoringContextError("unknown-domain", `Unknown L0 domain "${domainId}". L0 domains: ${roots.join(", ")}.`);
    }
    return {
      domain: ref(domain),
      domainOrdinal: ordinalOf(domain.id),
      l1: resolver.getChildren(domain.id).map((placement) => {
        const children = resolver.getChildren(placement.id);
        const preferred = resolver.getPreferredPlacementForConcept(placement.conceptId)?.id;
        return {
          ...ref(placement),
          ...(preferred && preferred !== placement.id ? { preferredElsewhere: preferred } : {}),
          levels: levelsOf(placement.conceptId),
          conceptPlacementCount: resolver.getPlacementsForConcept(placement.conceptId).length,
          childCount: children.length,
          childrenWithContent: children.filter((child) => hasContent(child.conceptId)).length,
        };
      }),
    };
  }

  return { inspectConcept, inspectDomain };
}

export type MapAuthoringInspector = ReturnType<typeof createMapAuthoringInspector>;
