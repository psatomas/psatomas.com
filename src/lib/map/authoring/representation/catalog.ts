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
  "variants",
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
  { structure: "lifecycle", block: "flow", fit: "native", expresses: "the stages an entity passes through from creation to retirement", limits: "no return to an earlier stage; a lifecycle with returns is a state model" },
  { structure: "failure-path", block: "flow", fit: "native", expresses: "how a fault propagates, or the outcomes a failure branches into" },
  { structure: "composition", block: "flow", fit: "approximate", expresses: "a whole and the parts or layers it is made of", limits: "drawn as a stage branching into parts; no nesting beyond one level" },
  { structure: "variants", block: "flow", fit: "approximate", expresses: "the kinds of something, each paired with what distinguishes it or what follows from it", limits: "drawn as a stage branching into one short branch per kind; one attribute per kind, not a table" },
  { structure: "interaction", block: "flow", fit: "approximate", expresses: "who acts, in what order, and what passes between participants", limits: "stages can name actors and actions, but messages between named lanes cannot be drawn" },
  { structure: "tension", block: "tensions", fit: "native", expresses: "recurring pairs of forces that pull against each other" },
  { structure: "vocabulary", block: "terms", fit: "native", expresses: "the terms a passage introduces, as a plain strip" },
  { structure: "cycle", block: "cycle", fit: "native", expresses: "a recurrent process whose last step feeds the next pass of the first (control and feedback loops)", limits: "one loop of at most six steps; not for a sequence that merely repeats or ends" },
  { structure: "state", block: "state", fit: "native", expresses: "persistent states or modes, and the events or conditions that move between them, including returns, transitions that keep the system where it is, and final states", limits: "two to six states and at most eight labelled transitions; at least one transition returns to an earlier or the same state, closing a loop. A forward process is a flow, and a recurrence of actions with no conditions is a cycle" },
  { structure: "comparison", block: "comparison", fit: "native", expresses: "several alternatives compared along the same explicit dimensions", limits: "two to six alternatives × two to four dimensions, short values; one dimension is variants, not a comparison" },
  { structure: "dependency", fit: "gap", expresses: "a graph of what relies on what, where dependencies are shared or form chains", limits: "a flow is a sequence, not a graph" },
];

export const catalogEntry = (structure: string): CatalogEntry | undefined => REPRESENTATION_CATALOG.find((entry) => entry.structure === structure);

/** Block kinds that carry structure rather than continuous prose. */
export const STRUCTURED_KINDS: ReadonlySet<BlockKind> = new Set(["flow", "distinction", "tensions", "cycle", "comparison", "state"]);
