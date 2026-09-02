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
  Component: ComponentType;
};

export type SystemSection = {
  heading: string;
  items: string[];
};

/** A "System" — the public term for what used to be called a Project (see
 * src/lib/systems.ts). Named for the public /systems route and IA: About /
 * Systems / Research / Lab. */
export type System = {
  slug: string;
  name: string;
  tagline: string;
  summary: string;
  description: string[];
  sections?: SystemSection[];
  stack: string[];
  repoUrl?: string;
};

// Research's domain types (ResearchArticleMetadata, ResearchCategory, etc.)
// live in src/lib/research/domain.ts, not here — Research is its own
// bounded module (repository interface, multiple storage adapters,
// authoring), the same way the Oracle experiment owns its domain model
// under src/experiments/oracle/domain/ rather than in this shared file.
// This file stays for types genuinely shared across the site (the Lab
// registry, Systems) that don't belong to one module.
