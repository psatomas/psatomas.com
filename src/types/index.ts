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
 * The known Research categories — a closed union rather than a free
 * string now that there's real content to base it on (three articles,
 * three categories). Add a new one here deliberately, in the same commit
 * as the article that needs it, rather than letting near-duplicate
 * strings ("Protocol engineering" vs "Protocol Engineering") accumulate
 * silently across files. Tags stay a free string[] — there's no fixed set
 * of those the way there is for category, and no filtering feature yet
 * that would need one.
 */
export type ResearchCategory = "EVM" | "Protocol Engineering" | "Distributed Systems";

/**
 * The metadata every Research article exports (see
 * src/content/research/*.mdx and src/lib/research.ts). Note this type
 * isn't actually checked against a given .mdx file's own `metadata`
 * export by tsc — .mdx isn't part of this project's TypeScript program,
 * so the only enforcement is the `as` cast where research.ts imports it.
 * It's still worth having: everything that reads `category` afterward
 * (research.ts, both page components) gets real narrowing and typo
 * protection, even though a wrong string in the .mdx source itself
 * wouldn't be caught until you actually looked at the rendered page.
 */
export type ResearchArticleMetadata = {
  slug: string;
  title: string;
  description: string;
  category: ResearchCategory;
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
