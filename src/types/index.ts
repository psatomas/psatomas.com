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

export type ProjectSection = {
  heading: string;
  items: string[];
};

export type Project = {
  slug: string;
  name: string;
  tagline: string;
  summary: string;
  description: string[];
  sections?: ProjectSection[];
  stack: string[];
  repoUrl?: string;
};
