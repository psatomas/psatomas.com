/**
 * The semantic structures an exposition may need to show, and what the MAP
 * content model can express for each today (docs/map-authoring/
 * representation-design.md). Development tooling only.
 *
 * A structure is a property of the concept's meaning; a block kind is how the
 * content model writes it down. The catalog records, for every structure,
 * whether an existing block expresses it natively, only approximately, or not
 * at all (a capability gap). It is a vocabulary for representation decisions,
 * never a checklist: no concept needs every structure.
 */
import type { MapContentBlock } from "../../types.ts";

export type BlockKind = MapContentBlock["kind"];

export const STRUCTURES = [
  "prose",
  "distinction",
  "process",
  "lifecycle",
  "failure-path",
  "composition",
  "interaction",
  "tension",
  "vocabulary",
  "cycle",
  "state",
  "comparison",
  "dependency",
] as const;
export type Structure = (typeof STRUCTURES)[number];

export type Fit = "native" | "approximate" | "gap";

export type CatalogEntry = {
  structure: Structure;
  /** What the structure communicates that the reader should perceive at a glance. */
  expresses: string;
  /** The block kind that writes it down; absent for a capability gap. */
  block?: BlockKind;
  fit: Fit;
  /** Where the fit ends: what the block cannot show for this structure. */
  limits?: string;
};

export const REPRESENTATION_CATALOG: readonly CatalogEntry[] = [
  { structure: "prose", block: "paragraph", fit: "native", expresses: "argument, causation, conditions and qualification: reasoning that is not a shape" },
  { structure: "distinction", block: "distinction", fit: "native", expresses: "notions a reader is likely to conflate, as A ≠ B or a chain" },
  { structure: "process", block: "flow", fit: "native", expresses: "ordered stages, branching into alternatives or parallel work and converging again" },
  { structure: "lifecycle", block: "flow", fit: "native", expresses: "the stages an entity passes through from creation to retirement", limits: "no return to an earlier stage" },
  { structure: "failure-path", block: "flow", fit: "native", expresses: "how a fault propagates, or the outcomes a failure branches into" },
  { structure: "composition", block: "flow", fit: "approximate", expresses: "a whole and the parts or layers it is made of", limits: "drawn as a stage branching into parts; no nesting beyond one level" },
  { structure: "interaction", block: "flow", fit: "approximate", expresses: "who acts, in what order, and what passes between participants", limits: "stages can name actors and actions, but messages between named lanes cannot be drawn" },
  { structure: "tension", block: "tensions", fit: "native", expresses: "recurring pairs of forces that pull against each other" },
  { structure: "vocabulary", block: "terms", fit: "native", expresses: "the terms a passage introduces, as a plain strip" },
  { structure: "cycle", fit: "gap", expresses: "a loop that feeds its output back into its input (control and feedback loops)", limits: "a flow cannot return to an earlier stage" },
  { structure: "state", fit: "gap", expresses: "states and the transitions between them, including returns and terminal states", limits: "a flow shows only a forward sequence of stages" },
  { structure: "comparison", fit: "gap", expresses: "several alternatives compared along shared dimensions", limits: "no table or matrix block; tensions pair forces, not alternatives × dimensions" },
  { structure: "dependency", fit: "gap", expresses: "a graph of what relies on what, where dependencies are shared or form chains", limits: "a flow is a sequence, not a graph" },
];

export const catalogEntry = (structure: string): CatalogEntry | undefined => REPRESENTATION_CATALOG.find((entry) => entry.structure === structure);

/** Block kinds that carry structure rather than continuous prose. */
export const STRUCTURED_KINDS: ReadonlySet<BlockKind> = new Set(["flow", "distinction", "tensions"]);
