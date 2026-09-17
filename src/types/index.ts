import type { ComponentType } from "react";

/**
 * Identifies a Protocol Lab experiment. Shared between each experiment's
 * own descriptor and the registry that aggregates them — neither module
 * depends on the other for this type.
 */
export type ExperimentId = "evm" | "intent-mev" | "oracle";

/**
 * The shape every experiment's index.ts exports. Living here (rather than
 * in the registry) keeps the dependency direction one-way: experiments and
 * the registry both depend on this shared type, but never on each other.
 */
export type ExperimentDefinition = {
  id: ExperimentId;
  index: string;
  title: string;
  subtitle: string;
  /** Short teaser shown on the /lab index card. */
  description: string;
  Component: ComponentType;
};

/** A named term paired with its one-line explanation — e.g. a contract or
 * package name plus its responsibility. Used by SystemSection.entries for
 * content that's a small glossary, not a flat bullet list. */
export type SystemSectionEntry = {
  term: string;
  detail: string;
};

/** One named sub-group of entries within a section — e.g. "On-Chain
 * Kernel" and "Off-Chain Infrastructure" as separate groups inside one
 * "Architecture" section, rather than flattening everything into one
 * list. */
export type SystemSectionGroup = {
  heading: string;
  entries: SystemSectionEntry[];
};

/** A system detail page's content sections support four different shapes
 * of content, all optional so a section can combine or use just one:
 * `items` (the original flat bullet list, still all that most systems
 * need), `entries` (term/detail pairs), `groups` (entries split into
 * named sub-groups), and `flow` (a short labeled sequence, rendered with
 * the same FlowBox/FlowArrow primitive Lab already uses). `lede` is an
 * optional intro paragraph before whichever of those follows. */
export type SystemSection = {
  heading: string;
  lede?: string;
  items?: string[];
  entries?: SystemSectionEntry[];
  groups?: SystemSectionGroup[];
  flow?: string[];
};

/** A "System" — the public term for what used to be called a Project (see
 * src/lib/systems.ts). Named for the public /systems route and IA: About /
 * Systems / Research / Lab. */
export type System = {
  slug: string;
  name: string;
  /** The system's formal/full name, shown under its public name when the
   * two differ (e.g. "ExeKPro" / "Execution Kernel Protocol") — optional
   * because most systems only have one name. */
  formalName?: string;
  tagline: string;
  summary: string;
  description: string[];
  sections?: SystemSection[];
  stack: string[];
  repoUrl?: string;
  /** The system's own live site, distinct from its GitHub repo — e.g.
   * exekpro.com. Optional: most systems here don't have one. */
  liveUrl?: string;
};

// Research's domain types (ResearchArticleMetadata, ResearchCategory, etc.)
// live in src/lib/research/domain.ts, not here — Research is its own
// bounded module (repository interface, multiple storage adapters,
// authoring), the same way the Oracle experiment owns its domain model
// under src/experiments/oracle/domain/ rather than in this shared file.
// This file stays for types genuinely shared across the site (the Lab
// registry, Systems) that don't belong to one module.
