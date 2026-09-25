/**
 * MAP's canonical domain types. These records intentionally contain no React,
 * route, explorer, or presentation concerns: a future server/build resolver
 * turns them into bounded view data for whatever UI needs it.
 */

export type MapConcept = {
  /** Stable canonical identity; initially identical to the public slug. */
  id: string;
  slug: string;
  title: string;
  /** Presentation policy only; never a second canonical identity. */
  preferredPlacementId?: string;
};

/** One pedagogical appearance of a canonical concept in the taxonomy forest. */
export type MapPlacement = {
  id: string;
  conceptId: string;
  parentPlacementId?: string;
  order: number;
  contextualLabel?: string;
  contextualNote?: string;
};

export const MAP_RELATIONSHIP_TYPES = {
  authenticates: {
    family: "identity",
    label: "authenticates",
    inverseLabel: "is authenticated by",
    allowsSelfEdge: false,
  },
  constrains: {
    family: "authority",
    label: "constrains",
    inverseLabel: "is constrained by",
    allowsSelfEdge: false,
  },
  enables: {
    family: "capability",
    label: "enables",
    inverseLabel: "is enabled by",
    allowsSelfEdge: false,
  },
  finalizes: {
    family: "mechanism",
    label: "finalizes",
    inverseLabel: "is finalized by",
    allowsSelfEdge: false,
  },
  dependsOn: {
    family: "dependency",
    label: "depends on",
    inverseLabel: "is depended on by",
    allowsSelfEdge: false,
  },
} as const;

export type MapRelationshipTypeId = keyof typeof MAP_RELATIONSHIP_TYPES;

/** A directed semantic edge between canonical concepts. */
export type MapRelationship = {
  id: string;
  sourceConceptId: string;
  targetConceptId: string;
  typeId: MapRelationshipTypeId;
};

/**
 * One unit of canonical exposition. Blocks carry meaning and order only:
 * no markup, styling, layout, or component instructions. Presentation decides
 * how each kind is rendered.
 */
export type MapContentBlock =
  | { kind: "paragraph"; text: string }
  /**
   * A conceptual model: ordered stages, each holding one or more elements. A
   * multi-element stage is a parallel set: the stage before branches into it
   * and it converges into the stage after (never two parallel sets in a row).
   */
  | { kind: "flow"; label: string; stages: readonly (readonly string[])[] }
  /** Two notions that must not be conflated ("left ≠ right"). */
  | { kind: "distinction"; left: string; right: string }
  /** Recurring pairs of forces that pull against each other. */
  | { kind: "tensions"; label: string; pairs: readonly (readonly [string, string])[] };

/** Canonical educational content, owned by at most one record per concept. */
export type MapConceptContent = {
  id: string;
  conceptId: string;
  /** The lead statement; exposition in `body` continues from it. */
  definition: string;
  summary?: string;
  explanation?: string;
  whyItMatters?: string;
  /** Ordered exposition following the definition, for richer teaching content. */
  body?: readonly MapContentBlock[];
};

/** A conceptual process step, not a UI or animation instruction. */
export type MapMechanismStep = {
  conceptId: string;
  label?: string;
  note?: string;
};

/** An ordered process explanation owned by a canonical concept. */
export type MapMechanism = {
  id: string;
  conceptId: string;
  title: string;
  summary?: string;
  steps: readonly MapMechanismStep[];
};

/** A curated linear learning sequence over canonical concepts. */
export type MapKnowledgePath = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  conceptIds: readonly string[];
};

export type MapKnowledgeModel = {
  concepts: readonly MapConcept[];
  placements: readonly MapPlacement[];
  relationships: readonly MapRelationship[];
  content: readonly MapConceptContent[];
  mechanisms: readonly MapMechanism[];
  knowledgePaths: readonly MapKnowledgePath[];
};
