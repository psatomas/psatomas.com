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

/**
 * The metadata every Research article exports (see
 * src/content/research/*.mdx and src/lib/research.ts). `category` and
 * `tags` are plain strings rather than a fixed enum — with zero articles
 * written yet there's no real taxonomy to encode, and inventing one now
 * would be guessing ahead of actual content.
 */
export type ResearchArticleMetadata = {
  slug: string;
  title: string;
  description: string;
  category: string;
  /** ISO date string, e.g. "2026-08-29" — sortable as-is. */
  date: string;
  tags: string[];
  /**
   * Set explicitly per article, not computed from rendered content —
   * computing it would mean rendering the article body somewhere, and
   * `react-dom/server` can't be imported into a Server Component's
   * import graph (Next.js forbids it outright), while the raw .mdx
   * source isn't readable at runtime on Cloudflare Workers either (see
   * research.ts). A hand-set number is simpler and has no failure mode.
   */
  readingMinutes: number;
};
